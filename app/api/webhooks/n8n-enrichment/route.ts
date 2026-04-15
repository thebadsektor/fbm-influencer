import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyN8nRequest } from "@/lib/verify-n8n-signature";

/**
 * Universal enrichment callback for any n8n workflow.
 *
 * All enrichment workflows call this single endpoint. They identify
 * themselves by `workflow` name and reference the EnrichmentRun created
 * when the app triggered them.
 *
 * Expected body (single or array):
 * {
 *   enrichmentRunId: string,          // created by app when triggering
 *   workflow: string,                 // "youtube-email-scraper", "affinity-profiling-v1", etc.
 *   status: "completed" | "failed" | "skipped",
 *   output?: object,                  // workflow-specific results
 *   error?: string,                   // error message if failed
 *   cost?: number,                    // cost in credits/tokens
 *   executionId?: string,             // n8n execution ID
 *   resultUpdates?: {                 // fields to apply to the parent Result
 *     email?: string,
 *     emailSource?: string,
 *     affinityProfile?: object,
 *     [key: string]: unknown
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  const verified = await verifyN8nRequest(req);
  if (!verified.ok) return verified.response;

  const body = verified.body as Record<string, unknown> | Record<string, unknown>[];
  const updates = Array.isArray(body) ? body : [body];

  let processed = 0;
  let errors = 0;

  for (const update of updates) {
    try {
      const enrichmentRunId = update.enrichmentRunId as string | undefined;
      const workflow = update.workflow as string | undefined;
      let status = update.status as string;

      if (!status) continue;

      // If n8n reports 'completed' but no email was actually found, tag as 'empty'
      // so the UI can distinguish "we looked and there is no public email" from
      // "we found an email". Eligibility logic still treats 'empty' like 'completed'
      // (don't retry — the channel genuinely lacks a contact email).
      if (status === "completed") {
        const out = update.output as Record<string, unknown> | null | undefined;
        const ru = update.resultUpdates as Record<string, unknown> | null | undefined;
        const foundEmail = (out?.email && String(out.email).trim()) || (ru?.email && String(ru.email).trim());
        if (!foundEmail) status = "empty";
      }

      // Find the enrichment run — by ID or by resultId + workflow.
      // IMPORTANT: do NOT filter by status here. A callback may arrive AFTER the
      // 30-minute stale-run sweep flipped the row to `failed`; we must still
      // accept the data — we already paid Apify for it. See investigation notes.
      let run;
      if (enrichmentRunId) {
        run = await prisma.enrichmentRun.findUnique({
          where: { id: enrichmentRunId },
        });
      }

      if (!run && workflow && update.resultId) {
        // Fallback: find most recent run for this result+workflow, regardless of status
        run = await prisma.enrichmentRun.findFirst({
          where: {
            resultId: update.resultId as string,
            workflow,
          },
          orderBy: { startedAt: "desc" },
        });
      }

      // If we still don't have an EnrichmentRun but we *do* have resultId + data,
      // apply the resultUpdates anyway. Losing a tracking row is recoverable; losing
      // a paid-for email is not.
      if (!run) {
        const fallbackResultId = update.resultId as string | undefined;
        const resultUpdates = update.resultUpdates as Record<string, unknown> | undefined;
        if (fallbackResultId && resultUpdates && Object.keys(resultUpdates).length > 0) {
          await applyResultUpdates(fallbackResultId, resultUpdates);
          processed++;
          console.warn(`[enrichment-callback] Rescue: no EnrichmentRun found for resultId=${fallbackResultId}, applied resultUpdates directly`);
        } else {
          errors++;
        }
        continue;
      }

      // If we're overwriting an already-swept failed row, log it so we can audit rescues.
      if (run.status === "failed" && status !== "failed") {
        console.warn(`[enrichment-callback] Rescued swept run ${run.id} (was failed → now ${status})`);
      }

      // Update the enrichment run
      await prisma.enrichmentRun.update({
        where: { id: run.id },
        data: {
          status,
          output: update.output ? JSON.parse(JSON.stringify(update.output)) : undefined,
          // Clear the stale-sweep error message if we're transitioning to a non-failed state
          error: status !== "failed" && run.status === "failed"
            ? null
            : ((update.error as string) ?? undefined),
          cost: update.cost != null ? Number(update.cost) : undefined,
          executionId: (update.executionId as string) ?? undefined,
          completedAt: ["completed", "failed", "skipped", "empty"].includes(status)
            ? new Date()
            : undefined,
        },
      });

      // Apply result updates if provided
      const resultUpdates = update.resultUpdates as Record<string, unknown> | undefined;
      if (resultUpdates && Object.keys(resultUpdates).length > 0) {
        await applyResultUpdates(run.resultId, resultUpdates);
      }

      processed++;
    } catch (e) {
      errors++;
      console.error("Enrichment callback error:", e);
    }
  }

  return NextResponse.json({ ok: true, processed, errors });
}

// Allow-list of Result fields the n8n callback is permitted to write.
const ALLOWED_RESULT_FIELDS = [
  "email", "emailSource", "emailType", "bio", "rawText",
  "hashtags", "crawlTargets", "verified", "avatar",
  "followers", "engagementRate", "videoCount", "totalViews",
  "avgViews", "avgLikes", "topVideoViews", "scrapeHits",
  "recentActivity", "affinityProfile", "campaignFitScore",
] as const;

async function applyResultUpdates(resultId: string, resultUpdates: Record<string, unknown>) {
  const safeUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resultUpdates)) {
    if ((ALLOWED_RESULT_FIELDS as readonly string[]).includes(key)) {
      // Don't overwrite a populated email with null/empty — protects against
      // a later callback clobbering a good result from an earlier one.
      if (key === "email" && (value === null || value === "" || value === undefined)) continue;
      safeUpdates[key] = value;
    }
  }
  if (Object.keys(safeUpdates).length > 0) {
    await prisma.result.update({ where: { id: resultId }, data: safeUpdates });
  }
}

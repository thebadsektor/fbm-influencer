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
      const status = update.status as string;

      if (!status) continue;

      // Find the enrichment run — by ID or by resultId + workflow
      let run;
      if (enrichmentRunId) {
        run = await prisma.enrichmentRun.findUnique({
          where: { id: enrichmentRunId },
        });
      }

      if (!run && workflow && update.resultId) {
        // Fallback: find by resultId + workflow (most recent pending one)
        run = await prisma.enrichmentRun.findFirst({
          where: {
            resultId: update.resultId as string,
            workflow,
            status: { in: ["pending", "running"] },
          },
          orderBy: { startedAt: "desc" },
        });
      }

      if (!run) {
        errors++;
        continue;
      }

      // Update the enrichment run
      await prisma.enrichmentRun.update({
        where: { id: run.id },
        data: {
          status,
          output: update.output ? JSON.parse(JSON.stringify(update.output)) : undefined,
          error: (update.error as string) ?? undefined,
          cost: update.cost != null ? Number(update.cost) : undefined,
          executionId: (update.executionId as string) ?? undefined,
          completedAt: ["completed", "failed", "skipped"].includes(status)
            ? new Date()
            : undefined,
        },
      });

      // Apply result updates if provided
      const resultUpdates = update.resultUpdates as Record<string, unknown> | undefined;
      if (resultUpdates && Object.keys(resultUpdates).length > 0) {
        // Build a safe update object — only allow known Result fields
        const allowedFields = [
          "email", "emailSource", "emailType", "bio", "rawText",
          "hashtags", "crawlTargets", "verified", "avatar",
          "followers", "engagementRate", "videoCount", "totalViews",
          "avgViews", "avgLikes", "topVideoViews", "scrapeHits",
          "recentActivity", "affinityProfile", "campaignFitScore",
        ];

        const safeUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(resultUpdates)) {
          if (allowedFields.includes(key)) {
            safeUpdates[key] = value;
          }
        }

        if (Object.keys(safeUpdates).length > 0) {
          await prisma.result.update({
            where: { id: run.resultId },
            data: safeUpdates,
          });
        }
      }

      processed++;
    } catch (e) {
      errors++;
      console.error("Enrichment callback error:", e);
    }
  }

  return NextResponse.json({ ok: true, processed, errors });
}

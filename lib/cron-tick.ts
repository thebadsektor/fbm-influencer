import prisma from "@/lib/prisma";
import { checkKHSetCompletion } from "@/lib/completion-detector";
import { continueToNextRound } from "@/lib/discovery-loop";
import { runEnrichmentStep, sweepStaleEnrichmentRuns } from "@/lib/enrichment-runner";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

// Statuses where the pipeline is mid-flight and the cron tick should actively
// try to advance things. `awaiting_approval` is handled separately (autoRun).
const ACTIVE_STATUSES = [
  "discovering",
  "processing",
  "iterating",
  "profiling",
  "analyzing",
  "enriching",
];

export interface CronTickSummary {
  sweptStaleRuns: number;
  stabilizationChecks: number;
  autoRunAdvances: number;
  retryTriggers: number;
  errors: string[];
  durationMs: number;
}

/**
 * Tick the pipeline forward for every campaign that needs it. Runs safely
 * on a short interval (30–60 s). Intended to replace UI-driven advancement:
 *
 *   1. Sweep stuck enrichment runs across all campaigns.
 *   2. For campaigns in `processing`/`iterating`, run the KH-set stabilization
 *      detector so discovery → profiling → enrichment advances without a user.
 *   3. For campaigns in `awaiting_approval` with `autoRun=true`, start the
 *      next round. Replaces the client-only AutoPlayTimer.
 *   4. For active campaigns with retry-eligible enrichment leads, fire
 *      `runEnrichmentStep` which picks up failed runs + new qualified leads.
 */
export async function runCronTick(): Promise<CronTickSummary> {
  const startedAt = Date.now();
  const summary: CronTickSummary = {
    sweptStaleRuns: 0,
    stabilizationChecks: 0,
    autoRunAdvances: 0,
    retryTriggers: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    summary.sweptStaleRuns = await sweepStaleEnrichmentRuns();
  } catch (err) {
    summary.errors.push(`sweep: ${errMsg(err)}`);
  }

  // ── 2. Stabilization detector for processing KH sets ─────────────────
  try {
    const processing = await prisma.kHSet.findMany({
      where: {
        status: "processing",
        campaign: { status: { in: ACTIVE_STATUSES } },
      },
      select: { id: true },
    });
    for (const set of processing) {
      try {
        await checkKHSetCompletion(set.id);
        summary.stabilizationChecks++;
      } catch (err) {
        summary.errors.push(`stabilize ${set.id}: ${errMsg(err)}`);
      }
    }
  } catch (err) {
    summary.errors.push(`fetch processing sets: ${errMsg(err)}`);
  }

  // ── 3. Auto-advance awaiting_approval campaigns ──────────────────────
  try {
    const waiting = await prisma.campaign.findMany({
      where: { status: "awaiting_approval", autoRun: true },
      select: { id: true },
    });
    for (const c of waiting) {
      try {
        await continueToNextRound(c.id);
        summary.autoRunAdvances++;
      } catch (err) {
        summary.errors.push(`autoRun ${c.id}: ${errMsg(err)}`);
      }
    }
  } catch (err) {
    summary.errors.push(`fetch waiting campaigns: ${errMsg(err)}`);
  }

  // ── 4. Retry enrichment for campaigns with backlog ───────────────────
  //
  // Pick any campaign that is active OR recently completed AND has at least
  // one retry-eligible lead (failed run, no in-flight or successful run) for
  // any configured workflow. We cap the retry scan to campaigns touched in
  // the last 30 days so the cron tick stays cheap.
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const campaignsToRetry = await findCampaignsWithRetryBacklog(cutoff);
    for (const c of campaignsToRetry) {
      try {
        const latestKhSet = await prisma.kHSet.findFirst({
          where: { campaignId: c.id },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (!latestKhSet) continue;
        await runEnrichmentStep(c.id, latestKhSet.id);
        summary.retryTriggers++;
      } catch (err) {
        summary.errors.push(`retry ${c.id}: ${errMsg(err)}`);
      }
    }
  } catch (err) {
    summary.errors.push(`fetch retry backlog: ${errMsg(err)}`);
  }

  summary.durationMs = Date.now() - startedAt;
  console.log(`[cron-tick] ${JSON.stringify(summary)}`);
  return summary;
}

/**
 * Campaigns that have at least one lead eligible for retry — i.e. a result
 * with a `failed` enrichment run and no pending/running/completed/empty run
 * for the same workflow. Mirrors the eligibility filter in
 * `runEnrichmentStep`; keeps the cron tick from triggering no-ops.
 */
async function findCampaignsWithRetryBacklog(cutoff: Date): Promise<{ id: string }[]> {
  const workflowIds = ENRICHMENT_WORKFLOWS.map((w) => w.id);
  const campaigns = await prisma.campaign.findMany({
    where: {
      updatedAt: { gte: cutoff },
      status: { notIn: ["draft", "aborted", "aborting", "failed"] },
      khSets: {
        some: {
          results: {
            some: {
              OR: [{ email: null }, { email: "" }],
              enrichmentRuns: {
                some: { workflow: { in: workflowIds }, status: "failed" },
              },
              NOT: {
                enrichmentRuns: {
                  some: {
                    workflow: { in: workflowIds },
                    status: { in: ["pending", "running", "completed", "empty"] },
                  },
                },
              },
            },
          },
        },
      },
    },
    select: { id: true },
    take: 20, // safety cap per tick
  });
  return campaigns;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

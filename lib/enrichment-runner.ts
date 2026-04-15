import prisma from "@/lib/prisma";
import { publishDiscoveryEvent } from "@/lib/redis";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

// How long a "running" EnrichmentRun must sit before the sweep gives up on it.
// Raised from 30 min → 2 h because:
//   1. A callback arriving AFTER the sweep used to be silently discarded; the new
//      webhook logic can now re-animate a swept row, so being too eager is only
//      a UI problem, not a data-loss one.
//   2. With chunked triggers (ENRICHMENT_CHUNK_SIZE) we no longer saturate
//      Apify, so ~46 s avg scrape should land well inside this window.
// If you want to disable the sweep entirely, set to a very large number.
const STALE_RUN_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface EnrichmentResult {
  workflowId: string;
  label: string;
  sent: number;
  eligible: number;
  deferred: boolean;
  reason?: string;
}

/**
 * Run all eligible enrichment workflows for a campaign.
 * Checks ALL accumulated leads across ALL rounds.
 *
 * Lifecycle:
 * 1. Clean up stale runs (stuck "running" > 30 min)
 * 2. For each workflow: count eligible leads, trigger if >= minBatch
 * 3. Only completed runs block re-enrichment (failed runs allow retry)
 */
export async function runEnrichmentStep(
  campaignId: string,
  khSetId: string,
): Promise<Record<string, EnrichmentResult>> {
  const results: Record<string, EnrichmentResult> = {};

  const allKhSets = await prisma.kHSet.findMany({
    where: { campaignId },
    select: { id: true },
  });
  const allKhSetIds = allKhSets.map((s) => s.id);

  // ── Lifecycle: clean up stale runs ──
  const staleCount = await prisma.enrichmentRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(Date.now() - STALE_RUN_THRESHOLD_MS) },
      result: { khSetId: { in: allKhSetIds } },
    },
    data: { status: "failed", error: "Timed out — no callback from enrichment service (may still arrive; late callbacks will re-animate this row)" },
  });
  if (staleCount.count > 0) {
    await publishDiscoveryEvent(khSetId, "enrichment_cleanup",
      `Cleared ${staleCount.count} stale enrichment runs (>2h without callback). Those leads are eligible for retry; late callbacks can still deliver data.`);
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "enriching" },
  });

  for (const workflow of ENRICHMENT_WORKFLOWS) {
    const inputType = (workflow as { inputType?: string }).inputType || "platformId";
    const platformFilter = (workflow.platform as string) === "ALL"
      ? {}
      : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

    // Base eligibility: ALL leads without email, across ALL rounds
    // Only exclude leads with a COMPLETED run (failed runs allow retry)
    const baseWhere = {
      khSetId: { in: allKhSetIds },
      ...platformFilter,
      OR: [{ email: null }, { email: "" }] as { email: null | string }[],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow: workflow.id,
            // Don't retry leads that already went through successfully (email found
            // OR confirmed empty by the scraper). Failed/running rows remain eligible.
            status: { in: ["completed", "empty"] },
          },
        },
      },
    };

    // Input-type-specific filters
    const extraWhere = inputType === "crawlTargets"
      ? { AND: [{ crawlTargets: { not: null } }, { NOT: { crawlTargets: "" } }] as object[] }
      : workflow.platformIdPrefix
        ? { platformId: { startsWith: workflow.platformIdPrefix } }
        : {};

    const eligibleCount = await prisma.result.count({
      where: { ...baseWhere, ...extraWhere },
    });

    if (eligibleCount < workflow.minBatch) {
      const reason = eligibleCount === 0
        ? `No ${workflow.label} leads available for enrichment.`
        : `${eligibleCount} ${workflow.label} leads eligible — collecting more before enriching (minimum ${workflow.minBatch} for cost efficiency).`;

      await publishDiscoveryEvent(khSetId, "enrichment_deferred",
        reason, { workflow: workflow.id, count: eligibleCount, minBatch: workflow.minBatch });

      results[workflow.id] = { workflowId: workflow.id, label: workflow.label, sent: 0, eligible: eligibleCount, deferred: true, reason };
      continue;
    }

    await publishDiscoveryEvent(khSetId, "enrichment_started",
      `Enriching ${eligibleCount} ${workflow.label} leads (prioritized by fit score)...`,
      { workflow: workflow.id, count: eligibleCount });

    try {
      const sent = await triggerN8nEnrichment(allKhSetIds, workflow, eligibleCount, inputType);
      results[workflow.id] = { workflowId: workflow.id, label: workflow.label, sent, eligible: eligibleCount, deferred: false };

      await publishDiscoveryEvent(khSetId, "enrichment_triggered",
        `${workflow.label}: ${sent} leads sent for enrichment. Highest-fit leads processed first.`,
        { workflow: workflow.id, sent });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await publishDiscoveryEvent(khSetId, "enrichment_error",
        `${workflow.label} enrichment failed: ${errorMsg}`,
        { workflow: workflow.id, error: errorMsg });
      results[workflow.id] = { workflowId: workflow.id, label: workflow.label, sent: 0, eligible: eligibleCount, deferred: false, reason: `Failed: ${errorMsg}` };
    }
  }

  return results;
}

async function triggerN8nEnrichment(
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
  inputType: string,
): Promise<number> {
  const platformFilter = (workflow.platform as string) === "ALL"
    ? {}
    : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

  const extraWhere = inputType === "crawlTargets"
    ? { AND: [{ crawlTargets: { not: null } }, { NOT: { crawlTargets: "" } }] as object[] }
    : workflow.platformIdPrefix
      ? { platformId: { startsWith: workflow.platformIdPrefix } }
      : {};

  // Prioritize: highest fit score first, then highest followers
  const eligible = await prisma.result.findMany({
    where: {
      khSetId: { in: allKhSetIds },
      ...platformFilter,
      OR: [{ email: null }, { email: "" }],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow: workflow.id,
            // Don't retry leads that already went through successfully (email found
            // OR confirmed empty by the scraper). Failed/running rows remain eligible.
            status: { in: ["completed", "empty"] },
          },
        },
      },
      ...extraWhere,
    },
    select: { id: true, platformId: true, creatorName: true, crawlTargets: true },
    orderBy: [
      { campaignFitScore: { sort: "desc", nulls: "last" } },
      { followers: { sort: "desc", nulls: "last" } },
    ],
    take: limit,
  });

  if (eligible.length === 0) return 0;

  if (inputType === "crawlTargets") {
    return await triggerUrlBasedEnrichment(eligible, workflow);
  } else {
    return await triggerPlatformIdBasedEnrichment(eligible, workflow);
  }
}

// Max leads per n8n webhook POST. Keeps Apify from being saturated to the point
// where individual scrapes take > 30 min and get swept. Each scrape is ~46s, so
// 50 per chunk caps n8n's in-flight queue at a manageable level.
const ENRICHMENT_CHUNK_SIZE = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function triggerPlatformIdBasedEnrichment(
  eligible: { id: string; platformId: string | null; creatorName: string | null }[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
): Promise<number> {
  const withValidId = eligible.filter((r) => r.platformId);
  if (withValidId.length === 0) return 0;

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) throw new Error("N8N_BASE_URL not configured");

  let sentTotal = 0;
  const chunks = chunk(withValidId, ENRICHMENT_CHUNK_SIZE);

  for (const batch of chunks) {
    const enrichmentRunMap: Record<string, { enrichmentRunId: string; resultId: string }> = {};
    for (const result of batch) {
      const run = await prisma.enrichmentRun.create({
        data: {
          resultId: result.id,
          workflow: workflow.id,
          status: "running",
          input: JSON.parse(JSON.stringify({ platformId: result.platformId, name: result.creatorName })),
        },
      });
      enrichmentRunMap[result.platformId!] = { enrichmentRunId: run.id, resultId: result.id };
    }

    try {
      const resp = await fetch(`${baseUrl}/webhook/${workflow.webhookPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.N8N_API_KEY ? { Authorization: `Bearer ${process.env.N8N_API_KEY}` } : {}) },
        body: JSON.stringify({
          channels: batch.map((r) => r.platformId!),
          enrichmentRunMap,
          callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-enrichment`,
          workflow: workflow.id,
        }),
      });

      if (!resp.ok) {
        // Mark just THIS chunk's rows as failed with the actual trigger error so
        // they're not left dangling as "running". Other chunks are unaffected.
        await prisma.enrichmentRun.updateMany({
          where: { id: { in: Object.values(enrichmentRunMap).map((m) => m.enrichmentRunId) } },
          data: { status: "failed", error: `n8n webhook returned ${resp.status}`, completedAt: new Date() },
        });
        console.error(`[enrichment] chunk trigger failed: HTTP ${resp.status} for ${batch.length} ${workflow.id} leads`);
        continue;
      }
      sentTotal += batch.length;
    } catch (err) {
      await prisma.enrichmentRun.updateMany({
        where: { id: { in: Object.values(enrichmentRunMap).map((m) => m.enrichmentRunId) } },
        data: { status: "failed", error: `trigger error: ${err instanceof Error ? err.message : String(err)}`, completedAt: new Date() },
      });
      console.error(`[enrichment] chunk trigger threw for ${batch.length} ${workflow.id} leads:`, err);
    }
  }

  return sentTotal;
}

async function triggerUrlBasedEnrichment(
  eligible: { id: string; platformId: string | null; creatorName: string | null; crawlTargets: string | null }[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
): Promise<number> {
  const withUrls = eligible.filter((r) => r.crawlTargets).map((r) => {
    const urls = r.crawlTargets!.split(",").map((u) => u.trim()).filter((u) =>
      u.includes("linktr.ee") || u.includes("beacons.ai") || u.includes("msha.ke") || u.includes("hoo.be") || u.includes("campsite.bio")
    );
    return { ...r, urls };
  }).filter((r) => r.urls.length > 0);

  if (withUrls.length === 0) return 0;

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) throw new Error("N8N_BASE_URL not configured");

  let sentTotal = 0;
  const chunks = chunk(withUrls, ENRICHMENT_CHUNK_SIZE);

  for (const batch of chunks) {
    const enrichmentRunMap: Record<string, { enrichmentRunId: string; resultId: string }> = {};
    const startUrls: { url: string }[] = [];
    for (const result of batch) {
      const url = result.urls[0];
      const run = await prisma.enrichmentRun.create({
        data: {
          resultId: result.id,
          workflow: workflow.id,
          status: "running",
          input: JSON.parse(JSON.stringify({ url, name: result.creatorName })),
        },
      });
      enrichmentRunMap[url] = { enrichmentRunId: run.id, resultId: result.id };
      startUrls.push({ url });
    }

    try {
      const resp = await fetch(`${baseUrl}/webhook/${workflow.webhookPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.N8N_API_KEY ? { Authorization: `Bearer ${process.env.N8N_API_KEY}` } : {}) },
        body: JSON.stringify({
          urls: startUrls,
          enrichmentRunMap,
          callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-enrichment`,
          workflow: workflow.id,
        }),
      });

      if (!resp.ok) {
        await prisma.enrichmentRun.updateMany({
          where: { id: { in: Object.values(enrichmentRunMap).map((m) => m.enrichmentRunId) } },
          data: { status: "failed", error: `n8n webhook returned ${resp.status}`, completedAt: new Date() },
        });
        console.error(`[enrichment] chunk trigger failed: HTTP ${resp.status} for ${batch.length} ${workflow.id} leads`);
        continue;
      }
      sentTotal += batch.length;
    } catch (err) {
      await prisma.enrichmentRun.updateMany({
        where: { id: { in: Object.values(enrichmentRunMap).map((m) => m.enrichmentRunId) } },
        data: { status: "failed", error: `trigger error: ${err instanceof Error ? err.message : String(err)}`, completedAt: new Date() },
      });
      console.error(`[enrichment] chunk trigger threw for ${batch.length} ${workflow.id} leads:`, err);
    }
  }

  return sentTotal;
}

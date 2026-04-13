import prisma from "@/lib/prisma";
import { publishDiscoveryEvent } from "@/lib/redis";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

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
    data: { status: "failed", error: "Timed out — no response from enrichment service" },
  });
  if (staleCount.count > 0) {
    await publishDiscoveryEvent(khSetId, "enrichment_cleanup",
      `Cleared ${staleCount.count} stale enrichment runs (stuck > 30min). Those leads are now eligible for retry.`);
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
            status: "completed" as const,
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
            status: "completed" as const,
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

async function triggerPlatformIdBasedEnrichment(
  eligible: { id: string; platformId: string | null; creatorName: string | null }[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
): Promise<number> {
  const withValidId = eligible.filter((r) => r.platformId);
  if (withValidId.length === 0) return 0;

  const enrichmentRunMap: Record<string, { enrichmentRunId: string; resultId: string }> = {};
  for (const result of withValidId) {
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

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) throw new Error("N8N_BASE_URL not configured");

  const resp = await fetch(`${baseUrl}/webhook/${workflow.webhookPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.N8N_API_KEY ? { Authorization: `Bearer ${process.env.N8N_API_KEY}` } : {}) },
    body: JSON.stringify({
      channels: withValidId.map((r) => r.platformId!),
      enrichmentRunMap,
      callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-enrichment`,
      workflow: workflow.id,
    }),
  });

  if (!resp.ok) throw new Error(`n8n webhook returned ${resp.status}`);
  return withValidId.length;
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

  const enrichmentRunMap: Record<string, { enrichmentRunId: string; resultId: string }> = {};
  const startUrls: { url: string }[] = [];

  for (const result of withUrls) {
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

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) throw new Error("N8N_BASE_URL not configured");

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

  if (!resp.ok) throw new Error(`n8n webhook returned ${resp.status}`);
  return withUrls.length;
}

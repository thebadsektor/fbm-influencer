import prisma from "@/lib/prisma";
import { publishDiscoveryEvent } from "@/lib/redis";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

export interface EnrichmentResult {
  workflowId: string;
  sent: number;
  deferred: boolean;
  reason?: string;
}

/**
 * Run all eligible enrichment workflows for a campaign.
 * Checks ALL accumulated qualified leads across ALL rounds (not just current round).
 *
 * For each workflow in ENRICHMENT_WORKFLOWS:
 * - Count qualified leads across all campaign rounds
 * - If count >= minBatch → trigger n8n enrichment workflow
 * - If count < minBatch → defer with message
 */
export async function runEnrichmentStep(
  campaignId: string,
  khSetId: string, // for Redis event scoping
): Promise<Record<string, EnrichmentResult>> {
  const results: Record<string, EnrichmentResult> = {};

  // Get ALL KH set IDs for this campaign (accumulated across rounds)
  const allKhSets = await prisma.kHSet.findMany({
    where: { campaignId },
    select: { id: true },
  });
  const allKhSetIds = allKhSets.map((s) => s.id);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "enriching" },
  });

  for (const workflow of ENRICHMENT_WORKFLOWS) {
    const inputType = (workflow as { inputType?: string }).inputType || "platformId";
    const platformFilter = (workflow.platform as string) === "ALL"
      ? {}
      : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

    // Build the where clause based on input type
    const baseWhere = {
      khSetId: { in: allKhSetIds }, // ALL rounds, not just current
      ...platformFilter,
      campaignFitScore: { gte: 60 },
      OR: [{ email: null }, { email: "" }] as { email: null | string }[],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow: workflow.id,
            status: { in: ["completed", "running", "pending"] },
          },
        },
      },
    };

    // Add input-type-specific filters
    const extraWhere = inputType === "crawlTargets"
      ? { crawlTargets: { not: { equals: "" } } } // must have linktree/beacons URLs
      : workflow.platformIdPrefix
        ? { platformId: { startsWith: workflow.platformIdPrefix } }
        : {};

    const eligibleCount = await prisma.result.count({
      where: { ...baseWhere, ...extraWhere },
    });

    if (eligibleCount < workflow.minBatch) {
      const reason = eligibleCount === 0
        ? `No qualified ${workflow.label} leads available for enrichment.`
        : `${eligibleCount} qualified ${workflow.label} leads — below minimum of ${workflow.minBatch} for cost-efficient enrichment. Collecting more next round.`;

      await publishDiscoveryEvent(khSetId, "enrichment_deferred",
        reason, { workflow: workflow.id, count: eligibleCount, minBatch: workflow.minBatch });

      results[workflow.id] = { workflowId: workflow.id, sent: 0, deferred: true, reason };
      continue;
    }

    // Enough leads — trigger enrichment
    await publishDiscoveryEvent(khSetId, "enrichment_started",
      `Enriching ${eligibleCount} ${workflow.label} leads...`,
      { workflow: workflow.id, count: eligibleCount });

    try {
      const sent = await triggerN8nEnrichment(campaignId, khSetId, allKhSetIds, workflow, eligibleCount, inputType);
      results[workflow.id] = { workflowId: workflow.id, sent, deferred: false };

      await publishDiscoveryEvent(khSetId, "enrichment_triggered",
        `${workflow.label} enrichment started for ${sent} leads. Results will arrive via callback.`,
        { workflow: workflow.id, sent });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await publishDiscoveryEvent(khSetId, "enrichment_error",
        `${workflow.label} enrichment failed: ${errorMsg}`,
        { workflow: workflow.id, error: errorMsg });
      results[workflow.id] = { workflowId: workflow.id, sent: 0, deferred: false, reason: `Failed: ${errorMsg}` };
    }
  }

  return results;
}

async function triggerN8nEnrichment(
  campaignId: string,
  khSetId: string,
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
  inputType: string,
): Promise<number> {
  const platformFilter = (workflow.platform as string) === "ALL"
    ? {}
    : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

  const extraWhere = inputType === "crawlTargets"
    ? { crawlTargets: { not: { equals: "" } } }
    : workflow.platformIdPrefix
      ? { platformId: { startsWith: workflow.platformIdPrefix } }
      : {};

  const eligible = await prisma.result.findMany({
    where: {
      khSetId: { in: allKhSetIds },
      ...platformFilter,
      campaignFitScore: { gte: 60 },
      OR: [{ email: null }, { email: "" }],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow: workflow.id,
            status: { in: ["completed", "running", "pending"] },
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

  // Build enrichment payload based on input type
  if (inputType === "crawlTargets") {
    return await triggerUrlBasedEnrichment(eligible, workflow, khSetId);
  } else {
    return await triggerPlatformIdBasedEnrichment(eligible, workflow, khSetId);
  }
}

/**
 * YouTube-style: sends platformIds (channel IDs) to n8n
 */
async function triggerPlatformIdBasedEnrichment(
  eligible: { id: string; platformId: string | null; creatorName: string | null }[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  khSetId: string,
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

/**
 * Linktree-style: sends URLs from crawlTargets to n8n
 */
async function triggerUrlBasedEnrichment(
  eligible: { id: string; platformId: string | null; creatorName: string | null; crawlTargets: string | null }[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  khSetId: string,
): Promise<number> {
  // Extract linktree/beacons URLs from crawlTargets
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
    const url = result.urls[0]; // Use first linktree URL
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

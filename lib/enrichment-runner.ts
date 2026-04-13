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
 * Run all eligible enrichment workflows for a completed round.
 * Called from discovery-loop.ts after AI Profiling + Analysis.
 *
 * For each workflow in ENRICHMENT_WORKFLOWS:
 * - Count qualified leads without email for that platform
 * - If count >= minBatch → trigger n8n enrichment workflow
 * - If count < minBatch → defer with message
 *
 * Returns aggregate results for storage in CampaignIteration.
 */
export async function runEnrichmentStep(
  campaignId: string,
  khSetId: string,
): Promise<Record<string, EnrichmentResult>> {
  const results: Record<string, EnrichmentResult> = {};

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "enriching" },
  });

  for (const workflow of ENRICHMENT_WORKFLOWS) {
    // Count qualified leads without email for this platform
    const platformFilter = (workflow.platform as string) === "ALL"
      ? {}
      : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

    const eligibleCount = await prisma.result.count({
      where: {
        khSetId,
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
        ...(workflow.platformIdPrefix
          ? { platformId: { startsWith: workflow.platformIdPrefix } }
          : {}),
      },
    });

    if (eligibleCount < workflow.minBatch) {
      // Defer — not enough leads
      const reason = eligibleCount === 0
        ? `No qualified ${workflow.label} leads without email this round.`
        : `${eligibleCount} qualified ${workflow.label} leads — below minimum of ${workflow.minBatch} for cost-efficient enrichment. Collecting more next round.`;

      await publishDiscoveryEvent(khSetId, "enrichment_deferred",
        reason, { workflow: workflow.id, count: eligibleCount, minBatch: workflow.minBatch });

      results[workflow.id] = {
        workflowId: workflow.id,
        sent: 0,
        deferred: true,
        reason,
      };
      continue;
    }

    // Enough leads — trigger enrichment
    await publishDiscoveryEvent(khSetId, "enrichment_started",
      `Enriching ${eligibleCount} ${workflow.label} channels...`,
      { workflow: workflow.id, count: eligibleCount });

    try {
      const sent = await triggerN8nEnrichment(campaignId, khSetId, workflow, eligibleCount);
      results[workflow.id] = {
        workflowId: workflow.id,
        sent,
        deferred: false,
      };

      await publishDiscoveryEvent(khSetId, "enrichment_triggered",
        `${workflow.label} enrichment started for ${sent} channels. Results will arrive shortly.`,
        { workflow: workflow.id, sent });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await publishDiscoveryEvent(khSetId, "enrichment_error",
        `${workflow.label} enrichment failed: ${errorMsg}`,
        { workflow: workflow.id, error: errorMsg });

      results[workflow.id] = {
        workflowId: workflow.id,
        sent: 0,
        deferred: false,
        reason: `Failed: ${errorMsg}`,
      };
    }
  }

  return results;
}

/**
 * Trigger a specific n8n enrichment workflow via webhook.
 */
async function triggerN8nEnrichment(
  campaignId: string,
  khSetId: string,
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
): Promise<number> {
  const platformFilter = (workflow.platform as string) === "ALL"
    ? {}
    : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

  // Get eligible results ordered by campaignFitScore (highest first)
  const eligible = await prisma.result.findMany({
    where: {
      khSetId,
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
      ...(workflow.platformIdPrefix
        ? { platformId: { startsWith: workflow.platformIdPrefix } }
        : {}),
    },
    select: { id: true, platformId: true, creatorName: true },
    orderBy: [
      { campaignFitScore: { sort: "desc", nulls: "last" } },
      { followers: { sort: "desc", nulls: "last" } },
    ],
    take: limit,
  });

  const withValidId = eligible.filter((r) => r.platformId);
  if (withValidId.length === 0) return 0;

  // Create EnrichmentRun records
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
    enrichmentRunMap[result.platformId!] = {
      enrichmentRunId: run.id,
      resultId: result.id,
    };
  }

  // POST to n8n webhook
  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) throw new Error("N8N_BASE_URL not configured");

  const channels = withValidId.map((r) => r.platformId!);
  const n8nPayload = {
    channels,
    enrichmentRunMap,
    callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-enrichment`,
    workflow: workflow.id,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_API_KEY) headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;

  const resp = await fetch(`${baseUrl}/webhook/${workflow.webhookPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(n8nPayload),
  });

  if (!resp.ok) throw new Error(`n8n webhook returned ${resp.status}`);

  return withValidId.length;
}

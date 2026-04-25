import prisma from "@/lib/prisma";
import { publishDiscoveryEvent } from "@/lib/redis";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

// How long a "running"/"pending" EnrichmentRun must sit before the sweep gives
// up on it. Raised from 30 min → 2 h because:
//   1. A callback arriving AFTER the sweep used to be silently discarded; the
//      webhook logic can now re-animate a swept row, so being too eager is
//      only a UI problem, not a data-loss one.
//   2. With chunked triggers (ENRICHMENT_CHUNK_SIZE) we no longer saturate
//      Apify, so ~46 s avg scrape should land well inside this window.
// If you want to disable the sweep entirely, set to a very large number.
export const STALE_RUN_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface EnrichmentResult {
  workflowId: string;
  label: string;
  sent: number;
  eligible: number;
  deferred: boolean;
  reason?: string;
}

/**
 * Sweep stuck `running`/`pending` EnrichmentRun rows older than the threshold
 * to `failed`. Safe to call from anywhere — cron tick, webhook, status route,
 * runEnrichmentStep — it's idempotent and late callbacks can still re-animate
 * swept rows via the webhook handler.
 *
 * @param campaignId Optional scope. When omitted, sweeps across all campaigns.
 * @returns Number of rows swept.
 */
export async function sweepStaleEnrichmentRuns(campaignId?: string): Promise<number> {
  const khSetFilter = campaignId
    ? { result: { khSet: { campaignId } } }
    : {};
  const res = await prisma.enrichmentRun.updateMany({
    where: {
      status: { in: ["running", "pending"] },
      startedAt: { lt: new Date(Date.now() - STALE_RUN_THRESHOLD_MS) },
      ...khSetFilter,
    },
    data: {
      status: "failed",
      error: "Timed out — no callback from enrichment service (may still arrive; late callbacks will re-animate this row)",
    },
  });
  return res.count;
}

/**
 * Run all eligible enrichment workflows for a campaign.
 * Checks ALL accumulated leads across ALL rounds.
 *
 * Lifecycle:
 * 1. Clean up stale runs
 * 2. For each workflow: count eligible leads, trigger if >= minBatch
 * 3. Leads with pending/running/completed/empty runs are excluded; failed
 *    runs are retry-eligible (handled via new EnrichmentRun rows)
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

  const staleCount = await sweepStaleEnrichmentRuns(campaignId);
  if (staleCount > 0) {
    await publishDiscoveryEvent(khSetId, "enrichment_cleanup",
      `Cleared ${staleCount} stale enrichment runs (>2h without callback). Those leads are eligible for retry; late callbacks can still deliver data.`);
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

    // Base eligibility: leads without email, no in-flight or terminal run for THIS workflow,
    // and (if dependsOn is set) every prerequisite workflow has reached completed/empty.
    // The dependsOn cascade keeps free workflows running first; paid workflows only fire
    // on leads where the cheaper providers already missed.
    const dependsOnFilters = (workflow.dependsOn ?? []).map((depId) => ({
      enrichmentRuns: {
        some: {
          workflow: depId,
          status: { in: ["completed", "empty"] },
        },
      },
    }));

    const baseWhere = {
      khSetId: { in: allKhSetIds },
      ...platformFilter,
      OR: [{ email: null }, { email: "" }] as { email: null | string }[],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow: workflow.id,
            // Exclude in-flight (pending/running) and successful (completed/empty)
            // runs. Only `failed` runs are retry-eligible — the cron tick + manual
            // retry endpoint picks those up by creating fresh EnrichmentRun rows.
            status: { in: ["pending", "running", "completed", "empty"] },
          },
        },
      },
      ...(dependsOnFilters.length > 0 ? { AND: dependsOnFilters } : {}),
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
      // Branch on runner — n8n / server / external-service share a common
      // EnrichmentRun lifecycle but reach the work via different transports.
      const sent = await triggerEnrichmentByRunner(allKhSetIds, workflow, eligibleCount, inputType);
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

/**
 * Fan out to the correct trigger based on workflow.runner. All paths share the
 * eligibility query shape (defined in `runEnrichmentStep`) and the EnrichmentRun
 * lifecycle. Only the actual work transport differs.
 */
async function triggerEnrichmentByRunner(
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
  inputType: string,
): Promise<number> {
  switch (workflow.runner) {
    case "n8n":
      return triggerN8nEnrichment(allKhSetIds, workflow, limit, inputType);
    case "server":
      return triggerServerSideEnrichment(allKhSetIds, workflow, limit, inputType);
    case "external-service":
      return triggerExternalServiceEnrichment(allKhSetIds, workflow, limit, inputType);
    default:
      throw new Error(`Unknown enrichment runner: ${(workflow as { runner: string }).runner}`);
  }
}

/**
 * Build the eligibility WHERE clause for a workflow. Used by every trigger so
 * the cascade (dependsOn) is enforced consistently.
 */
function buildEligibilityWhere(
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  inputType: string,
): Record<string, unknown> {
  const platformFilter = (workflow.platform as string) === "ALL"
    ? {}
    : { platform: { contains: workflow.platform, mode: "insensitive" as const } };

  const extraWhere = inputType === "crawlTargets"
    ? { AND: [{ crawlTargets: { not: null } }, { NOT: { crawlTargets: "" } }] as object[] }
    : workflow.platformIdPrefix
      ? { platformId: { startsWith: workflow.platformIdPrefix } }
      : {};

  const dependsOnFilters = (workflow.dependsOn ?? []).map((depId) => ({
    enrichmentRuns: {
      some: { workflow: depId, status: { in: ["completed", "empty"] } },
    },
  }));

  // Merge dependsOn AND with the input-type AND if both exist.
  const ANDClause = [
    ...((extraWhere as { AND?: object[] }).AND ?? []),
    ...dependsOnFilters,
  ];

  return {
    khSetId: { in: allKhSetIds },
    ...platformFilter,
    ...(ANDClause.length > 0 ? { AND: ANDClause } : {}),
    ...(inputType === "crawlTargets" ? {} : extraWhere),
    OR: [{ email: null }, { email: "" }],
    NOT: {
      enrichmentRuns: {
        some: {
          workflow: workflow.id,
          status: { in: ["pending", "running", "completed", "empty"] },
        },
      },
    },
  };
}

async function triggerN8nEnrichment(
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
  inputType: string,
): Promise<number> {
  const where = buildEligibilityWhere(allKhSetIds, workflow, inputType);

  const eligible = await prisma.result.findMany({
    where: where as never,
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

// ─── runner: "server" (in-process Node handlers) ──────────────────────────
//
// For workflows with `runner: "server"` and a `handler` registered in
// lib/enrichment-handlers/. Runs synchronously per-result. No external I/O,
// safe in a request handler — but it BLOCKS for the duration of the batch.
// Keep handlers fast (regex over short strings, no fetch, no LLM).

async function triggerServerSideEnrichment(
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
  inputType: string,
): Promise<number> {
  const { getHandler } = await import("@/lib/enrichment-handlers");
  if (!workflow.handler) {
    throw new Error(`workflow ${workflow.id} runner=server but no handler set`);
  }
  const handler = getHandler(workflow.handler);
  if (!handler) {
    throw new Error(`unknown enrichment handler: ${workflow.handler}`);
  }

  const where = buildEligibilityWhere(allKhSetIds, workflow, inputType);
  const eligible = await prisma.result.findMany({
    where: where as never,
    select: {
      id: true, platformId: true, creatorName: true, creatorHandle: true,
      bio: true, rawText: true, crawlTargets: true, profileUrl: true,
    },
    orderBy: [
      { campaignFitScore: { sort: "desc", nulls: "last" } },
      { followers: { sort: "desc", nulls: "last" } },
    ],
    take: limit,
  });
  if (eligible.length === 0) return 0;

  let processed = 0;
  for (const result of eligible) {
    const run = await prisma.enrichmentRun.create({
      data: {
        resultId: result.id,
        workflow: workflow.id,
        status: "running",
        input: { source: "server-handler", handler: workflow.handler },
      },
    });

    try {
      const out = await handler({ result, workflowId: workflow.id });
      const updateData: Record<string, unknown> = {
        status: out.status,
        completedAt: new Date(),
        output: out.output ? JSON.parse(JSON.stringify(out.output)) : undefined,
      };
      if (out.status === "failed") updateData.error = out.error;
      else if (out.status === "empty") updateData.error = out.reason ?? null;

      await prisma.enrichmentRun.update({ where: { id: run.id }, data: updateData });

      if (out.status === "completed") {
        await prisma.result.update({
          where: { id: result.id },
          data: { email: out.email, emailSource: out.emailSource },
        });
      }
      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await prisma.enrichmentRun.update({
        where: { id: run.id },
        data: { status: "failed", error: errorMsg, completedAt: new Date() },
      });
      console.error(`[enrichment:server] handler ${workflow.handler} threw for result ${result.id}:`, err);
    }
  }
  return processed;
}

// ─── runner: "external-service" (Railway-deployed scraper worker) ─────────
//
// Synchronous batch POST to a separate Railway service (see fbm-scraper-worker
// repo). The service performs HTTP fetches + email extraction and returns a
// per-item result inline. Each batch corresponds to one HTTP round-trip.

const EXTERNAL_SERVICE_BATCH_SIZE = 50;
const EXTERNAL_SERVICE_TIMEOUT_MS = 60_000;

type ExternalServiceResult = {
  key: string;
  url: string;
  email: string | null;
  source?: "mailto" | "json-ld" | "text";
  reason?: string;
  finalUrl?: string;
};

async function triggerExternalServiceEnrichment(
  allKhSetIds: string[],
  workflow: typeof ENRICHMENT_WORKFLOWS[number],
  limit: number,
  inputType: string,
): Promise<number> {
  const serviceUrl = process.env.SCRAPER_SERVICE_URL;
  if (!serviceUrl) {
    throw new Error("SCRAPER_SERVICE_URL not configured (cannot run external-service workflow)");
  }
  if (!workflow.servicePath) {
    throw new Error(`workflow ${workflow.id} runner=external-service but no servicePath set`);
  }

  const where = buildEligibilityWhere(allKhSetIds, workflow, inputType);
  const eligible = await prisma.result.findMany({
    where: where as never,
    select: { id: true, platformId: true, creatorName: true, crawlTargets: true },
    orderBy: [
      { campaignFitScore: { sort: "desc", nulls: "last" } },
      { followers: { sort: "desc", nulls: "last" } },
    ],
    take: limit,
  });
  if (eligible.length === 0) return 0;

  // Expand each Result into its first eligible URL. Today only crawlTargets
  // workflows make sense for the external service.
  const items: { resultId: string; key: string; url: string }[] = [];
  for (const r of eligible) {
    if (inputType === "crawlTargets") {
      const urls = (r.crawlTargets ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      const first = urls[0];
      if (first) items.push({ resultId: r.id, key: r.id, url: first });
    }
  }
  if (items.length === 0) return 0;

  let processed = 0;
  const batches = chunk(items, EXTERNAL_SERVICE_BATCH_SIZE);
  for (const batch of batches) {
    const runs = await Promise.all(
      batch.map((item) =>
        prisma.enrichmentRun.create({
          data: {
            resultId: item.resultId,
            workflow: workflow.id,
            status: "running",
            input: { url: item.url, source: "external-service" },
          },
        })
      )
    );
    const runByKey = new Map(runs.map((run, i) => [batch[i].key, run]));

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), EXTERNAL_SERVICE_TIMEOUT_MS);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.SCRAPER_AUTH_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.SCRAPER_AUTH_TOKEN}`;
      }

      const resp = await fetch(`${serviceUrl}${workflow.servicePath}`, {
        method: "POST",
        headers,
        signal: ctrl.signal,
        body: JSON.stringify({ items: batch.map((i) => ({ key: i.key, url: i.url })) }),
      }).finally(() => clearTimeout(timer));

      if (!resp.ok) {
        await prisma.enrichmentRun.updateMany({
          where: { id: { in: runs.map((r) => r.id) } },
          data: { status: "failed", error: `scraper service returned ${resp.status}`, completedAt: new Date() },
        });
        console.error(`[enrichment:external] ${workflow.id} HTTP ${resp.status} for ${batch.length} items`);
        continue;
      }

      const body = (await resp.json()) as { results?: ExternalServiceResult[] };
      const responseResults = body.results ?? [];

      for (const res of responseResults) {
        const run = runByKey.get(res.key);
        if (!run) continue;

        if (res.email) {
          await prisma.enrichmentRun.update({
            where: { id: run.id },
            data: {
              status: "completed",
              completedAt: new Date(),
              output: { email: res.email, source: res.source, finalUrl: res.finalUrl },
            },
          });
          await prisma.result.update({
            where: { id: run.resultId },
            data: { email: res.email, emailSource: workflow.id },
          });
        } else {
          await prisma.enrichmentRun.update({
            where: { id: run.id },
            data: {
              status: "empty",
              completedAt: new Date(),
              error: res.reason ?? null,
              output: { finalUrl: res.finalUrl },
            },
          });
        }
        processed++;
      }

      // Any run we didn't see in the response → mark failed.
      const seenKeys = new Set(responseResults.map((r) => r.key));
      const orphanIds = batch
        .filter((b) => !seenKeys.has(b.key))
        .map((b) => runByKey.get(b.key)?.id)
        .filter((id): id is string => !!id);
      if (orphanIds.length > 0) {
        await prisma.enrichmentRun.updateMany({
          where: { id: { in: orphanIds } },
          data: { status: "failed", error: "scraper service omitted result", completedAt: new Date() },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.enrichmentRun.updateMany({
        where: { id: { in: runs.map((r) => r.id) } },
        data: { status: "failed", error: `scraper trigger error: ${msg}`, completedAt: new Date() },
      });
      console.error(`[enrichment:external] ${workflow.id} trigger threw:`, err);
    }
  }
  return processed;
}

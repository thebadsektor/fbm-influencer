import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";
import { sweepStaleEnrichmentRuns } from "@/lib/enrichment-runner";

/**
 * Get enrichment stats for a campaign: email counts, workflow breakdown,
 * active runs, and cost tracking.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
    select: { id: true, enrichmentBudget: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSets = await prisma.kHSet.findMany({
    where: { campaignId: id },
    select: { id: true },
  });
  const khSetIds = khSets.map((s) => s.id);

  // Proactive cleanup: expire stale running/pending enrichment runs (> 2h).
  // Late callbacks can still re-animate a swept row (see n8n-enrichment webhook).
  // Delegates to the standalone sweep helper so all call sites stay in sync.
  if (khSetIds.length > 0) {
    await sweepStaleEnrichmentRuns(id);
  }

  if (khSetIds.length === 0) {
    return NextResponse.json({
      emailStats: { total: 0, withEmail: 0, percentage: 0, byPlatform: {} },
      workflowBreakdown: [],
      totalEnrichmentCost: 0,
      enrichmentBudget: null,
    });
  }

  // Email stats by platform. `percentage` divides by ALL scraped results
  // (historical metric — capped by qualification rate). New fields below
  // express the more useful ratios: attempted/eligible and emails/attempted.
  const results = await prisma.result.findMany({
    where: { khSetId: { in: khSetIds } },
    select: { platform: true, email: true, profileUrl: true },
  });

  const byPlatform: Record<string, { total: number; withEmail: number; percentage: number }> = {};
  let totalWithEmail = 0;
  let totalEligible = 0;

  for (const r of results) {
    const p = r.platform || "unknown";
    if (!byPlatform[p]) byPlatform[p] = { total: 0, withEmail: 0, percentage: 0 };
    byPlatform[p].total++;
    if (r.email && r.email.trim()) {
      byPlatform[p].withEmail++;
      totalWithEmail++;
    }
    if (r.profileUrl && (!r.email || !r.email.trim())) totalEligible++;
  }
  for (const p of Object.keys(byPlatform)) {
    byPlatform[p].percentage = byPlatform[p].total > 0
      ? Math.round((byPlatform[p].withEmail / byPlatform[p].total) * 1000) / 10
      : 0;
  }

  // Per-workflow breakdown with all status counts
  const allRuns = await prisma.enrichmentRun.findMany({
    where: { result: { khSetId: { in: khSetIds } } },
    select: {
      workflow: true,
      status: true,
      cost: true,
      output: true,
    },
  });

  const workflowMap = new Map<string, {
    workflow: string;
    label: string;
    completed: number;
    running: number;
    pending: number;
    failed: number;
    empty: number;
    emailsFound: number;
    cost: number;
  }>();

  // Initialize from config
  for (const wf of ENRICHMENT_WORKFLOWS) {
    workflowMap.set(wf.id, {
      workflow: wf.id,
      label: wf.label,
      completed: 0,
      running: 0,
      pending: 0,
      failed: 0,
      empty: 0,
      emailsFound: 0,
      cost: 0,
    });
  }

  for (const run of allRuns) {
    let entry = workflowMap.get(run.workflow);
    if (!entry) {
      entry = { workflow: run.workflow, label: run.workflow, completed: 0, running: 0, pending: 0, failed: 0, empty: 0, emailsFound: 0, cost: 0 };
      workflowMap.set(run.workflow, entry);
    }

    if (run.status === "completed") {
      entry.completed++;
      const output = run.output as Record<string, unknown> | null;
      if (output?.email) entry.emailsFound++;
    } else if (run.status === "running") {
      entry.running++;
    } else if (run.status === "pending") {
      entry.pending++;
    } else if (run.status === "failed") {
      entry.failed++;
    } else if (run.status === "empty") {
      entry.empty++;
    }
    entry.cost += run.cost ?? 0;
  }

  const workflowBreakdown = [...workflowMap.values()];
  const totalEnrichmentCost = workflowBreakdown.reduce((s, w) => s + w.cost, 0);
  const totalActive = workflowBreakdown.reduce((s, w) => s + w.running + w.pending, 0);

  // ── Per-workflow reachability ───────────────────────────────────────
  // The backend's `runEnrichmentStep` filters by platformIdPrefix (for
  // platformId-based scrapers like YouTube "UC…") or by `crawlTargets`
  // (for URL-based scrapers like TikTok linktree). Any lead that fails
  // these extra filters is invisible to enrichment — it can never be
  // attempted even if it has a profileUrl. Previously the UI counted
  // these as "remaining", which is why MAGA Campaign 4 appeared to have
  // 1,548 leads still to enrich when 1,546 of them were actually
  // un-enrichable. Now we report both so users know the real backlog.
  const reachablePerWorkflow = await Promise.all(
    ENRICHMENT_WORKFLOWS.map(async (wf) => {
      const inputType = (wf as { inputType?: string }).inputType || "platformId";
      const platformFilter = (wf.platform as string) === "ALL"
        ? {}
        : { platform: { contains: wf.platform, mode: "insensitive" as const } };
      const extraWhere = inputType === "crawlTargets"
        ? { AND: [{ crawlTargets: { not: null } }, { NOT: { crawlTargets: "" } }] as object[] }
        : wf.platformIdPrefix
          ? { platformId: { startsWith: wf.platformIdPrefix } }
          : {};
      const reachable = await prisma.result.count({
        where: {
          khSetId: { in: khSetIds },
          ...platformFilter,
          OR: [{ email: null }, { email: "" }],
          ...extraWhere,
          NOT: {
            enrichmentRuns: {
              some: {
                workflow: wf.id,
                status: { in: ["pending", "running", "completed", "empty"] },
              },
            },
          },
        },
      });
      return { workflow: wf.id, label: wf.label, reachable };
    })
  );
  for (const r of reachablePerWorkflow) {
    const entry = workflowMap.get(r.workflow);
    if (entry) (entry as unknown as Record<string, number>).reachable = r.reachable;
  }

  // ── Unreachable breakdown — "why is my dashboard stuck" ─────────────
  // Results with no email where the platform-specific identifier (UC
  // channel ID / crawlTarget URL) is missing — they exist in `Result`
  // but enrichment workflows skip them. Surfacing this stops users from
  // waiting forever.
  const [ytMissingChannelId, tkMissingCrawlTargets] = await Promise.all([
    prisma.result.count({
      where: {
        khSetId: { in: khSetIds },
        platform: { contains: "YOUTUBE", mode: "insensitive" },
        OR: [{ email: null }, { email: "" }],
        NOT: { platformId: { startsWith: "UC" } },
      },
    }),
    prisma.result.count({
      where: {
        khSetId: { in: khSetIds },
        platform: { contains: "TIKTOK", mode: "insensitive" },
        OR: [{ email: null }, { email: "" }],
        AND: [
          {
            OR: [
              { crawlTargets: null },
              { crawlTargets: "" },
            ],
          },
        ],
      },
    }),
  ]);
  const totalReachable = reachablePerWorkflow.reduce((s, r) => s + r.reachable, 0);
  const totalUnreachable = ytMissingChannelId + tkMissingCrawlTargets;

  // ── Per-round breakdown ─────────────────────────────────────────────
  // Aggregated from Result→KHSet. Shows each discovery round's own
  // enrichment state so users can see "Round 3 had 78 failures" instead
  // of one campaign-wide number.
  const rounds = await buildPerRoundBreakdown(id);

  // ── Top failure reasons ─────────────────────────────────────────────
  // Tells the user *why* runs fail — actionable if e.g. 90% are "n8n
  // webhook returned 500" (n8n is down) vs "Apify account out of credit".
  const failedRuns = await prisma.enrichmentRun.findMany({
    where: {
      status: "failed",
      result: { khSetId: { in: khSetIds } },
      startedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { error: true, workflow: true },
    take: 2000, // cap to keep this route cheap
  });
  const reasonMap = new Map<string, { reason: string; count: number; workflow: string }>();
  for (const fr of failedRuns) {
    const raw = (fr.error ?? "(no error message)").slice(0, 160);
    const key = `${fr.workflow}|${raw}`;
    const existing = reasonMap.get(key);
    if (existing) existing.count++;
    else reasonMap.set(key, { reason: raw, count: 1, workflow: fr.workflow });
  }
  const topFailureReasons = [...reasonMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Honest metrics: attempts vs eligible, emails found vs attempts.
  const attempted = workflowBreakdown.reduce((s, w) => s + w.completed + w.empty + w.failed, 0);
  const emailsFound = workflowBreakdown.reduce((s, w) => s + w.emailsFound, 0);
  const totalEligibleNow = totalReachable + attempted;

  return NextResponse.json({
    emailStats: {
      total: results.length,
      withEmail: totalWithEmail,
      percentage: results.length > 0 ? Math.round((totalWithEmail / results.length) * 1000) / 10 : 0,
      byPlatform,
    },
    enrichmentProgress: {
      // `eligible` = attempted + reachable-but-not-yet-attempted. This is
      // the honest denominator. `legacyRemaining` is the old, too-broad
      // "profileUrl without email" count — kept only for the legacy meter.
      eligible: totalEligibleNow,
      attempted,
      remaining: totalReachable,
      legacyRemaining: totalEligible,
      emailsFound,
      attemptRate: totalEligibleNow > 0 ? Math.round((attempted / totalEligibleNow) * 1000) / 10 : 0,
      emailHitRate: attempted > 0 ? Math.round((emailsFound / attempted) * 1000) / 10 : 0,
    },
    unreachable: {
      total: totalUnreachable,
      youtubeMissingChannelId: ytMissingChannelId,
      tiktokMissingCrawlTargets: tkMissingCrawlTargets,
    },
    workflowBreakdown,
    rounds,
    topFailureReasons,
    totalActive,
    totalEnrichmentCost,
    enrichmentBudget: campaign.enrichmentBudget,
  });
}

// Aggregate per-round enrichment stats. Rows are keyed by the KH set's
// `iterationNumber` — so Round N covers every result scraped in the Nth
// discovery pass. A single query would need Prisma $queryRaw; we use the
// findMany + manual reduce path instead, which stays type-safe and is
// fine at this scale (one campaign = tens of rounds max).
async function buildPerRoundBreakdown(campaignId: string) {
  const sets = await prisma.kHSet.findMany({
    where: { campaignId },
    orderBy: { iterationNumber: "asc" },
    select: {
      id: true,
      iterationNumber: true,
      status: true,
      results: {
        select: {
          email: true,
          enrichmentRuns: { select: { status: true } },
        },
      },
    },
  });

  return sets.map((s) => {
    let withEmail = 0;
    let totalResults = 0;
    let completed = 0;
    let empty = 0;
    let failed = 0;
    let inFlight = 0;
    for (const r of s.results) {
      totalResults++;
      if (r.email && r.email.trim()) withEmail++;
      for (const er of r.enrichmentRuns) {
        if (er.status === "completed") completed++;
        else if (er.status === "empty") empty++;
        else if (er.status === "failed") failed++;
        else if (er.status === "running" || er.status === "pending") inFlight++;
      }
    }
    return {
      round: s.iterationNumber,
      khSetStatus: s.status,
      totalResults,
      withEmail,
      completed,
      empty,
      failed,
      inFlight,
    };
  });
}

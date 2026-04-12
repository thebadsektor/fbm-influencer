import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";

/**
 * Get enrichment stats for a campaign: email counts by platform,
 * active enrichment runs, and recent run history.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    select: { id: true, enrichmentBudget: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get all KH set IDs for this campaign
  const khSets = await prisma.kHSet.findMany({
    where: { campaignId: id },
    select: { id: true },
  });
  const khSetIds = khSets.map((s) => s.id);

  if (khSetIds.length === 0) {
    return NextResponse.json({
      emailStats: { total: 0, withEmail: 0, percentage: 0, byPlatform: {} },
      activeRuns: [],
      recentRuns: [],
      totalEnrichmentCost: 0,
    });
  }

  // Email stats by platform
  const results = await prisma.result.findMany({
    where: { khSetId: { in: khSetIds } },
    select: { platform: true, email: true },
  });

  const byPlatform: Record<string, { total: number; withEmail: number; percentage: number }> = {};
  let totalWithEmail = 0;

  for (const r of results) {
    const p = r.platform || "unknown";
    if (!byPlatform[p]) byPlatform[p] = { total: 0, withEmail: 0, percentage: 0 };
    byPlatform[p].total++;
    if (r.email && r.email.trim()) {
      byPlatform[p].withEmail++;
      totalWithEmail++;
    }
  }
  for (const p of Object.keys(byPlatform)) {
    byPlatform[p].percentage = byPlatform[p].total > 0
      ? Math.round((byPlatform[p].withEmail / byPlatform[p].total) * 1000) / 10
      : 0;
  }

  // Active enrichment runs
  const activeRuns = await prisma.enrichmentRun.groupBy({
    by: ["workflow"],
    where: {
      resultId: { in: results.map(() => "").length > 0 ? undefined : undefined },
      status: { in: ["pending", "running"] },
      result: { khSetId: { in: khSetIds } },
    },
    _count: true,
  }).catch(() => []);

  // Simpler active runs query
  const activeRunDetails = await prisma.enrichmentRun.findMany({
    where: {
      status: { in: ["pending", "running"] },
      result: { khSetId: { in: khSetIds } },
    },
    select: { workflow: true, status: true, startedAt: true },
  });

  const activeByWorkflow: Record<string, { total: number; running: number; pending: number; startedAt: string }> = {};
  for (const run of activeRunDetails) {
    if (!activeByWorkflow[run.workflow]) {
      activeByWorkflow[run.workflow] = { total: 0, running: 0, pending: 0, startedAt: run.startedAt.toISOString() };
    }
    activeByWorkflow[run.workflow].total++;
    if (run.status === "running") activeByWorkflow[run.workflow].running++;
    if (run.status === "pending") activeByWorkflow[run.workflow].pending++;
  }

  // Recent completed runs (last 10)
  const recentRuns = await prisma.enrichmentRun.findMany({
    where: {
      status: "completed",
      result: { khSetId: { in: khSetIds } },
    },
    select: {
      workflow: true,
      cost: true,
      completedAt: true,
      output: true,
    },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  // Aggregate recent runs by date + workflow
  const totalEnrichmentCost = recentRuns.reduce((s, r) => s + (r.cost ?? 0), 0);
  const emailsFound = recentRuns.filter((r) => {
    const output = r.output as Record<string, unknown> | null;
    return output?.email;
  }).length;

  return NextResponse.json({
    emailStats: {
      total: results.length,
      withEmail: totalWithEmail,
      percentage: results.length > 0 ? Math.round((totalWithEmail / results.length) * 1000) / 10 : 0,
      byPlatform,
    },
    activeRuns: Object.entries(activeByWorkflow).map(([workflow, data]) => ({
      workflow,
      ...data,
    })),
    recentRuns: {
      count: recentRuns.length,
      emailsFound,
      totalCost: totalEnrichmentCost,
    },
    totalEnrichmentCost,
    enrichmentBudget: campaign.enrichmentBudget,
  });
}

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

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
    where: { id, userId: user.id },
    select: { id: true, enrichmentBudget: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSets = await prisma.kHSet.findMany({
    where: { campaignId: id },
    select: { id: true },
  });
  const khSetIds = khSets.map((s) => s.id);

  if (khSetIds.length === 0) {
    return NextResponse.json({
      emailStats: { total: 0, withEmail: 0, percentage: 0, byPlatform: {} },
      workflowBreakdown: [],
      totalEnrichmentCost: 0,
      enrichmentBudget: null,
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
      emailsFound: 0,
      cost: 0,
    });
  }

  for (const run of allRuns) {
    let entry = workflowMap.get(run.workflow);
    if (!entry) {
      entry = { workflow: run.workflow, label: run.workflow, completed: 0, running: 0, pending: 0, failed: 0, emailsFound: 0, cost: 0 };
      workflowMap.set(run.workflow, entry);
    }

    if (run.status === "completed") {
      entry.completed++;
      // Check if this run found an email
      const output = run.output as Record<string, unknown> | null;
      if (output?.email) entry.emailsFound++;
    } else if (run.status === "running") {
      entry.running++;
    } else if (run.status === "pending") {
      entry.pending++;
    } else if (run.status === "failed") {
      entry.failed++;
    }
    entry.cost += run.cost ?? 0;
  }

  const workflowBreakdown = [...workflowMap.values()];
  const totalEnrichmentCost = workflowBreakdown.reduce((s, w) => s + w.cost, 0);
  const totalActive = workflowBreakdown.reduce((s, w) => s + w.running + w.pending, 0);

  return NextResponse.json({
    emailStats: {
      total: results.length,
      withEmail: totalWithEmail,
      percentage: results.length > 0 ? Math.round((totalWithEmail / results.length) * 1000) / 10 : 0,
      byPlatform,
    },
    workflowBreakdown,
    totalActive,
    totalEnrichmentCost,
    enrichmentBudget: campaign.enrichmentBudget,
  });
}

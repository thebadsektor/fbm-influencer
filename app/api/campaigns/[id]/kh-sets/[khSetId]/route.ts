import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { checkKHSetCompletion } from "@/lib/completion-detector";

type Params = { params: Promise<{ id: string; khSetId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: isAdmin(user) ? { id } : { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check for completion on each poll (stabilization-based)
  await checkKHSetCompletion(khSetId).catch((err) => {
    console.error("[kh-set-get] Completion check error:", err);
  });

  const set = await prisma.kHSet.findUnique({
    where: { id: khSetId },
    include: { results: { orderBy: { createdAt: "desc" } } },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Include live result count (more accurate than stored totalScraped during scraping)
  const liveResultCount = set.status === "processing"
    ? await prisma.result.count({ where: { khSetId } })
    : set.totalScraped;

  // Include campaign status and iteration intelligence
  const iteration = await prisma.campaignIteration.findFirst({
    where: { khSetId },
  });

  return NextResponse.json({
    ...set,
    totalScraped: liveResultCount || set.totalScraped,
    campaignStatus: campaign?.status,
    iteration: iteration ? {
      profiledCount: iteration.profiledCount,
      skippedCount: iteration.skippedCount,
      avgFitScore: iteration.avgFitScore,
      profilingCost: iteration.profilingCost,
      profilingDuration: iteration.profilingDuration,
      discoveryDuration: iteration.discoveryDuration,
      analysisNarrative: iteration.analysisNarrative,
      strategyForNext: iteration.strategyForNext,
      learnings: iteration.learnings,
      topPerformingKeywords: iteration.topPerformingKeywords,
      enrichmentResults: iteration.enrichmentResults,
    } : null,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: isAdmin(user) ? { id } : { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.locked) return NextResponse.json({ error: "KH set is locked" }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.kHSet.update({
    where: { id: khSetId },
    data: {
      ...(body.keywords && { keywords: body.keywords }),
      ...(body.hashtags && { hashtags: body.hashtags }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  const campaign = await prisma.campaign.findFirst({ where: isAdmin(user) ? { id } : { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade: delete enrichment runs → results → iteration → KH set
  await prisma.enrichmentRun.deleteMany({
    where: { result: { khSetId } },
  });
  await prisma.result.deleteMany({ where: { khSetId } });
  await prisma.campaignIteration.deleteMany({ where: { khSetId } });
  await prisma.kHSet.delete({ where: { id: khSetId } });

  // If campaign was failed due to this round, reset to awaiting_approval or completed
  if (campaign.status === "failed") {
    const remainingSets = await prisma.kHSet.count({ where: { campaignId: id } });
    if (remainingSets > 0) {
      await prisma.campaign.update({
        where: { id },
        data: { status: "awaiting_approval" },
      });
    } else {
      await prisma.campaign.update({
        where: { id },
        data: { status: "draft" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

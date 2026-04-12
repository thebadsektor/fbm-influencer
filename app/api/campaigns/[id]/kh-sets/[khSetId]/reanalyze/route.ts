import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { profileBatch, type CampaignContext } from "@/lib/affinity-profiler";
import { analyzeIteration } from "@/lib/iteration-analyzer";
import { publishDiscoveryEvent } from "@/lib/redis";

/**
 * Retry AI profiling and/or analysis for a specific KH set.
 * Used when a round gets stuck in "profiling" or "analyzing" status.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; khSetId: string }> }
) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: { iterations: { orderBy: { iterationNumber: "asc" } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!set) return NextResponse.json({ error: "KH set not found" }, { status: 404 });

  const campaignContext: CampaignContext = {
    name: campaign.name,
    marketingGoal: campaign.marketingGoal,
    brandNiche: campaign.brandNiche,
    targetAudienceAge: campaign.targetAudienceAge,
    targetLocation: campaign.targetLocation,
    audienceInterests: campaign.audienceInterests,
  };

  // Check if profiling is needed
  const unprofiledCount = await prisma.result.count({
    where: { khSetId, affinityProfile: { equals: Prisma.DbNull } },
  });

  let profilingResult = null;
  if (unprofiledCount > 0) {
    await prisma.campaign.update({ where: { id }, data: { status: "profiling" } });
    await publishDiscoveryEvent(khSetId, "profiling_retry", `Retrying AI profiling for ${unprofiledCount} creators...`);

    const unprofiledResults = await prisma.result.findMany({
      where: { khSetId, affinityProfile: { equals: Prisma.DbNull } },
      select: {
        id: true, platform: true, platformId: true,
        creatorName: true, creatorHandle: true,
        bio: true, rawText: true, hashtags: true,
        followers: true, engagementRate: true,
      },
    });

    profilingResult = await profileBatch(unprofiledResults, campaignContext, { khSetId });
  }

  // Run analysis
  await prisma.campaign.update({ where: { id }, data: { status: "analyzing" } });
  await publishDiscoveryEvent(khSetId, "analysis_started", "Running round analysis...");

  const profiled = await prisma.result.findMany({
    where: { khSetId, NOT: { affinityProfile: { equals: Prisma.DbNull } } },
    select: { campaignFitScore: true, affinityProfile: true, hashtags: true, rawText: true },
  });

  const avgFitScore = profiled.length > 0
    ? Math.round(profiled.reduce((s, r) => s + (r.campaignFitScore ?? 0), 0) / profiled.length)
    : 0;

  const analysis = await analyzeIteration(
    id, khSetId,
    profilingResult ?? {
      profiledCount: profiled.length,
      skippedCount: 0,
      avgFitScore,
      fitDistribution: {},
      contentThemeFrequency: {},
      errors: 0,
      cost: 0,
      durationMs: 0,
    },
    campaignContext,
    set.keywords,
    set.hashtags,
    campaign.iterations.map((i) => ({
      iterationNumber: i.iterationNumber,
      keywordsUsed: i.keywordsUsed,
      hashtagsUsed: i.hashtagsUsed,
      avgFitScore: i.avgFitScore,
      topPerformingKeywords: i.topPerformingKeywords,
      lowPerformingKeywords: i.lowPerformingKeywords,
      learnings: i.learnings,
      strategyForNext: i.strategyForNext,
      exclusionPatterns: i.exclusionPatterns,
    }))
  );

  // Save/update iteration
  const existingIteration = await prisma.campaignIteration.findFirst({ where: { khSetId } });
  const iterationNumber = set.iterationNumber || 1;

  if (existingIteration) {
    await prisma.campaignIteration.update({
      where: { id: existingIteration.id },
      data: {
        profiledCount: profilingResult?.profiledCount ?? profiled.length,
        skippedCount: profilingResult?.skippedCount ?? 0,
        avgFitScore,
        analysisNarrative: analysis.analysisNarrative,
        strategyForNext: analysis.strategyForNext,
        learnings: analysis.learnings,
        topPerformingKeywords: analysis.topPerformingKeywords,
        lowPerformingKeywords: analysis.lowPerformingKeywords,
        exclusionPatterns: JSON.parse(JSON.stringify(analysis.exclusionPatterns)),
        profilingCost: profilingResult?.cost ?? existingIteration.profilingCost,
      },
    });
  } else {
    await prisma.campaignIteration.create({
      data: {
        campaignId: id,
        iterationNumber,
        khSetId,
        keywordsUsed: set.keywords,
        hashtagsUsed: set.hashtags,
        platformUsed: set.platform,
        resultsCount: await prisma.result.count({ where: { khSetId } }),
        profiledCount: profilingResult?.profiledCount ?? profiled.length,
        skippedCount: profilingResult?.skippedCount ?? 0,
        avgFitScore,
        analysisNarrative: analysis.analysisNarrative,
        strategyForNext: analysis.strategyForNext,
        learnings: analysis.learnings,
        topPerformingKeywords: analysis.topPerformingKeywords,
        lowPerformingKeywords: analysis.lowPerformingKeywords,
        exclusionPatterns: JSON.parse(JSON.stringify(analysis.exclusionPatterns)),
        contentThemeFrequency: JSON.parse(JSON.stringify(profilingResult?.contentThemeFrequency ?? {})),
        profilingCost: profilingResult?.cost ?? 0,
        profilingDuration: profilingResult ? Math.round(profilingResult.durationMs / 1000) : 0,
      },
    });
  }

  await prisma.campaign.update({ where: { id }, data: { status: "awaiting_approval" } });
  await publishDiscoveryEvent(khSetId, "plan_ready",
    `Analysis complete. Ready for next round. Auto-starting in 30 seconds...`);

  return NextResponse.json({ ok: true, avgFitScore, profiledCount: profilingResult?.profiledCount ?? profiled.length });
}

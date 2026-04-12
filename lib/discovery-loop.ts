import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { generateKHSet, type StrategyContext } from "@/lib/kh-generator";
import { profileBatch, type CampaignContext } from "@/lib/affinity-profiler";
import { analyzeIteration, type ExclusionPatterns } from "@/lib/iteration-analyzer";
import { publishDiscoveryEvent } from "@/lib/redis";
import type { LLMProvider } from "@/lib/llm";

const MIN_NEW_LEADS_PER_RUN = 10;
const MIN_AVG_FIT_SCORE = 15; // Stop if average fit drops below this

/**
 * After a discovery run completes, run the full intelligence pipeline:
 * 1. Batch affinity profiling
 * 2. Iteration analysis
 * 3. Store memory
 * 4. Intelligent stopping decision
 * 5. Generate next KH set with strategy
 * 6. Submit to n8n
 */
export async function triggerNextIteration(
  campaignId: string,
  completedKhSetId: string,
  newResultCount: number
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      khSets: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { results: true } } },
      },
      documents: true,
      iterations: { orderBy: { iterationNumber: "asc" } },
    },
  });

  if (!campaign) return;

  // ── Abort check ──
  if (campaign.status === "aborting" || campaign.status === "aborted") {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "aborted" } });
    return;
  }

  const completedSets = campaign.khSets.filter((s) => s.status === "completed");
  const totalLeads = completedSets.reduce((sum, s) => sum + s._count.results, 0);
  const completedIterations = completedSets.length;

  // ── Target met check ──
  if (totalLeads >= campaign.targetLeads) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "completed" } });
    await publishDiscoveryEvent(completedKhSetId, "campaign_completed",
      `Target met! ${totalLeads}/${campaign.targetLeads} leads found in ${completedIterations} rounds.`);
    return;
  }

  // ── Max iterations check ──
  if (completedIterations >= campaign.maxIterations) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "completed" } });
    await publishDiscoveryEvent(completedKhSetId, "campaign_completed",
      `Max iterations reached (${completedIterations}). ${totalLeads}/${campaign.targetLeads} leads found.`);
    return;
  }

  // ── Diminishing returns (raw count) ──
  if (completedIterations > 1 && newResultCount < MIN_NEW_LEADS_PER_RUN) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "completed" } });
    await publishDiscoveryEvent(completedKhSetId, "campaign_completed",
      `Diminishing returns — only ${newResultCount} new leads. Stopping.`);
    return;
  }

  // ── PHASE 1: Batch Affinity Profiling ──
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "profiling" } });

  const unprofiledResults = await prisma.result.findMany({
    where: { khSetId: completedKhSetId, affinityProfile: { equals: Prisma.DbNull } },
    select: {
      id: true, platform: true, platformId: true,
      creatorName: true, creatorHandle: true,
      bio: true, rawText: true, hashtags: true,
      followers: true, engagementRate: true,
    },
  });

  const campaignContext: CampaignContext = {
    name: campaign.name,
    marketingGoal: campaign.marketingGoal,
    brandNiche: campaign.brandNiche,
    targetAudienceAge: campaign.targetAudienceAge,
    targetLocation: campaign.targetLocation,
    audienceInterests: campaign.audienceInterests,
  };

  // Get exclusion patterns from last iteration (if any)
  const lastIteration = campaign.iterations[campaign.iterations.length - 1];
  const priorExclusions = lastIteration?.exclusionPatterns as unknown as ExclusionPatterns | undefined;

  const profilingResult = await profileBatch(unprofiledResults, campaignContext, {
    khSetId: completedKhSetId,
    exclusionPatterns: priorExclusions as Record<string, unknown> | undefined,
  });

  // ── Abort check (profiling took time) ──
  const refreshedCampaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (refreshedCampaign?.status === "aborting") {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "aborted" } });
    return;
  }

  // ── Intelligent stopping: fit score quality ──
  if (completedIterations > 1 && profilingResult.avgFitScore < MIN_AVG_FIT_SCORE) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "completed" } });
    await publishDiscoveryEvent(completedKhSetId, "campaign_completed",
      `Low quality — avg fit score ${profilingResult.avgFitScore}/100. Stopping to avoid wasted searches.`);
    // Still save the iteration memory before stopping
    await saveIterationMemory(campaignId, completedKhSetId, completedIterations,
      campaign.khSets.find(s => s.id === completedKhSetId)!, profilingResult, null);
    return;
  }

  // ── PHASE 2: Iteration Analysis ──
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "analyzing" } });

  const currentKhSet = campaign.khSets.find((s) => s.id === completedKhSetId)!;
  const previousIterationsData = campaign.iterations.map((i) => ({
    iterationNumber: i.iterationNumber,
    keywordsUsed: i.keywordsUsed,
    hashtagsUsed: i.hashtagsUsed,
    avgFitScore: i.avgFitScore,
    topPerformingKeywords: i.topPerformingKeywords,
    lowPerformingKeywords: i.lowPerformingKeywords,
    learnings: i.learnings,
    strategyForNext: i.strategyForNext,
    exclusionPatterns: i.exclusionPatterns,
  }));

  const analysis = await analyzeIteration(
    campaignId, completedKhSetId, profilingResult, campaignContext,
    currentKhSet.keywords, currentKhSet.hashtags,
    previousIterationsData
  );

  // ── PHASE 3: Store Iteration Memory ──
  await saveIterationMemory(campaignId, completedKhSetId, completedIterations,
    currentKhSet, profilingResult, analysis);

  // ── PHASE 4: Generate Next KH Set with Strategy ──
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "iterating" } });

  const nextIteration = completedIterations + 1;
  await publishDiscoveryEvent(completedKhSetId, "iteration_preparing",
    `Preparing iteration ${nextIteration} with strategy intelligence...`);

  const allPreviousKeywords = campaign.khSets.flatMap((s) => s.keywords);
  const allPreviousHashtags = campaign.khSets.flatMap((s) => s.hashtags);
  const allLearnings = [...campaign.iterations.flatMap((i) => i.learnings), ...analysis.learnings];

  const strategyContext: StrategyContext = {
    topPerformingKeywords: analysis.topPerformingKeywords,
    lowPerformingKeywords: analysis.lowPerformingKeywords,
    exclusionPatterns: analysis.exclusionPatterns,
    strategyRecommendation: analysis.strategyForNext,
    accumulatedLearnings: allLearnings,
    avgFitScoreByIteration: [
      ...campaign.iterations.map((i) => i.avgFitScore),
      profilingResult.avgFitScore,
    ],
  };

  const docContents = campaign.documents.map((d) => d.content);
  const provider: LLMProvider = "openai";

  try {
    const newSet = await generateKHSet({
      campaignId,
      campaign,
      documentContents: docContents,
      minKeywords: campaign.targetKeywords,
      maxKeywords: campaign.targetKeywords,
      minHashtags: campaign.targetHashtags,
      maxHashtags: campaign.targetHashtags,
      provider,
      iterationNumber: nextIteration,
      previousKeywords: allPreviousKeywords,
      previousHashtags: allPreviousHashtags,
      previousResults: {
        creatorsFound: totalLeads,
        topCreatorThemes: Object.keys(profilingResult.contentThemeFrequency).slice(0, 15),
        topHashtagsFromContent: Object.keys(analysis.contentThemeFrequency).slice(0, 20),
      },
      strategyContext,
    });

    await publishDiscoveryEvent(completedKhSetId, "iteration_started",
      `Round ${nextIteration} starting — ${newSet.keywords.length} new keywords, ${newSet.hashtags.length} new hashtags`);

    await submitKHSetToN8n(campaignId, newSet.id);
  } catch (err) {
    console.error("[discovery-loop] Iteration failed:", err);
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "failed" } });
    await publishDiscoveryEvent(completedKhSetId, "error",
      `Iteration ${nextIteration} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Helpers ──

async function saveIterationMemory(
  campaignId: string,
  khSetId: string,
  iterationNumber: number,
  khSet: { keywords: string[]; hashtags: string[]; platform: string | null; updatedAt: Date },
  profiling: { profiledCount: number; skippedCount: number; avgFitScore: number; fitDistribution: Record<string, number>; contentThemeFrequency: Record<string, number>; cost: number; durationMs: number },
  analysis: { topPerformingKeywords: string[]; lowPerformingKeywords: string[]; exclusionPatterns: ExclusionPatterns; contentThemeFrequency: Record<string, number>; analysisNarrative: string; strategyForNext: string; learnings: string[] } | null
) {
  // Compute discovery duration from KH set submission to callback
  const discoveryDuration = Math.round(
    (Date.now() - new Date(khSet.updatedAt).getTime()) / 1000
  );

  await prisma.campaignIteration.create({
    data: {
      campaignId,
      iterationNumber,
      khSetId,
      keywordsUsed: khSet.keywords,
      hashtagsUsed: khSet.hashtags,
      platformUsed: khSet.platform,
      resultsCount: profiling.profiledCount + profiling.skippedCount,
      profiledCount: profiling.profiledCount,
      skippedCount: profiling.skippedCount,
      avgFitScore: profiling.avgFitScore,
      fitDistribution: JSON.parse(JSON.stringify(profiling.fitDistribution)),
      topPerformingKeywords: analysis?.topPerformingKeywords ?? [],
      lowPerformingKeywords: analysis?.lowPerformingKeywords ?? [],
      exclusionPatterns: analysis?.exclusionPatterns ? JSON.parse(JSON.stringify(analysis.exclusionPatterns)) : undefined,
      contentThemeFrequency: JSON.parse(JSON.stringify(profiling.contentThemeFrequency)),
      analysisNarrative: analysis?.analysisNarrative ?? null,
      strategyForNext: analysis?.strategyForNext ?? null,
      learnings: analysis?.learnings ?? [],
      profilingCost: profiling.cost,
      profilingDuration: Math.round(profiling.durationMs / 1000),
      discoveryDuration,
    },
  });

  await publishDiscoveryEvent(khSetId, "memory_saved",
    `Iteration ${iterationNumber} memory saved — ${analysis?.learnings.length ?? 0} learnings recorded`);
}

async function submitKHSetToN8n(campaignId: string, khSetId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!campaign || !set) throw new Error("Campaign or KH set not found");

  const webhookId = process.env.N8N_WEBHOOK_ID;
  const baseUrl = process.env.N8N_BASE_URL;
  if (!webhookId || !baseUrl) throw new Error("N8N_WEBHOOK_ID or N8N_BASE_URL not configured");

  const platform = "both";
  const n8nPayload = {
    "Marketing Goal": campaign.marketingGoal,
    "Brand/Niche": campaign.brandNiche,
    "Target Audience Age": campaign.targetAudienceAge,
    "Target Location": campaign.targetLocation.join(", "),
    "Audience Interests": campaign.audienceInterests.join(", "),
    "Min Followers": campaign.minFollowers,
    "Min Engagement Rate (%)": campaign.minEngagementRate,
    "Number of Influencers": campaign.numberOfInfluencers,
    "Trending Topics/Hashtags": set.hashtags.join(", "),
    "Competitor Brands/Creators": campaign.competitorBrands || "",
    "Additional Keywords": set.keywords.join(", "),
    platform,
    khSetId: set.id,
    callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-callback`,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_API_KEY) headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;

  const response = await fetch(`${baseUrl}/webhook/${webhookId}`, {
    method: "POST", headers, body: JSON.stringify(n8nPayload),
  });

  if (!response.ok) throw new Error(`n8n webhook returned ${response.status}`);

  await prisma.kHSet.update({
    where: { id: khSetId },
    data: { status: "processing", locked: true, platform },
  });
}

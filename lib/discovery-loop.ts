import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { generateKHSet, type StrategyContext } from "@/lib/kh-generator";
import { profileBatch, type CampaignContext } from "@/lib/affinity-profiler";
import { analyzeIteration, type ExclusionPatterns } from "@/lib/iteration-analyzer";
import { publishDiscoveryEvent } from "@/lib/redis";
import { runEnrichmentStep } from "@/lib/enrichment-runner";
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

  const campaignContext: CampaignContext = {
    name: campaign.name,
    marketingGoal: campaign.marketingGoal,
    brandNiche: campaign.brandNiche,
    targetAudienceAge: campaign.targetAudienceAge,
    targetLocation: campaign.targetLocation,
    audienceInterests: campaign.audienceInterests,
  };

  const currentKhSet = campaign.khSets.find((s) => s.id === completedKhSetId)!;
  const lastIteration = campaign.iterations[campaign.iterations.length - 1];
  const priorExclusions = lastIteration?.exclusionPatterns as unknown as ExclusionPatterns | undefined;

  // ── PHASE 1: Batch Affinity Profiling ──
  let profilingResult;
  try {
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

    const withData = unprofiledResults.filter(r =>
      (r.rawText && r.rawText.trim().length > 10) || (r.bio && r.bio.trim().length > 5)
    );
    const withoutData = unprofiledResults.length - withData.length;

    await publishDiscoveryEvent(completedKhSetId, "profiling_summary",
      `${unprofiledResults.length} creators to evaluate. ${withData.length} have enough content for AI analysis. ${withoutData} will be set aside (insufficient data).`);

    profilingResult = await profileBatch(unprofiledResults, campaignContext, {
      khSetId: completedKhSetId,
      exclusionPatterns: priorExclusions as Record<string, unknown> | undefined,
    });

    // Check if profiling actually worked
    if (profilingResult.profiledCount === 0 && profilingResult.errors > 0) {
      throw new Error(`All ${profilingResult.errors} profiling calls failed. Check OPENAI_API_KEY.`);
    }

    await publishDiscoveryEvent(completedKhSetId, "profiling_done",
      `AI profiling complete. ${profilingResult.profiledCount} profiled, ${profilingResult.skippedCount} skipped. Avg campaign fit: ${profilingResult.avgFitScore}/100. Cost: $${profilingResult.cost.toFixed(2)}`);

  } catch (err) {
    console.error("[discovery-loop] Profiling failed:", err);
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "failed" } });
    await publishDiscoveryEvent(completedKhSetId, "error",
      `AI profiling failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

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
    await saveIterationMemory(campaignId, completedKhSetId, completedIterations,
      currentKhSet, profilingResult, null);
    return;
  }

  // ── PHASE 2: Iteration Analysis ──
  let analysis;
  try {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "analyzing" } });
    await publishDiscoveryEvent(completedKhSetId, "analysis_started",
      `Analyzing round ${completedIterations} results — identifying what worked, what didn't, and planning strategy...`);

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

    analysis = await analyzeIteration(
      campaignId, completedKhSetId, profilingResult, campaignContext,
      currentKhSet.keywords, currentKhSet.hashtags,
      previousIterationsData
    );

    await publishDiscoveryEvent(completedKhSetId, "analysis_done",
      `Analysis complete. ${analysis.learnings.length} learnings. Top keywords: ${analysis.topPerformingKeywords.slice(0, 3).join(", ") || "none identified"}`);

  } catch (err) {
    console.error("[discovery-loop] Analysis failed:", err);
    // Analysis failure is non-fatal — save what we have and continue
    analysis = null;
    await publishDiscoveryEvent(completedKhSetId, "warning",
      `Analysis failed but continuing: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── PHASE 3: Store Iteration Memory ──
  await saveIterationMemory(campaignId, completedKhSetId, completedIterations,
    currentKhSet, profilingResult, analysis);

  // ── PHASE 4: Email Enrichment (auto, if enough qualified leads) ──
  let enrichmentResults: Record<string, unknown> = {};
  try {
    enrichmentResults = await runEnrichmentStep(campaignId, completedKhSetId);
  } catch (err) {
    console.error("[discovery-loop] Enrichment failed:", err);
    await publishDiscoveryEvent(completedKhSetId, "warning",
      `Enrichment step failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Update iteration with enrichment results
  const iterationRecord = await prisma.campaignIteration.findFirst({ where: { khSetId: completedKhSetId } });
  if (iterationRecord) {
    await prisma.campaignIteration.update({
      where: { id: iterationRecord.id },
      data: { enrichmentResults: JSON.parse(JSON.stringify(enrichmentResults)) },
    });
  }

  // ── PHASE 5: Pause for approval (30s auto-continue on client) ──
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "awaiting_approval" } });

  const nextIteration = completedIterations + 1;
  await publishDiscoveryEvent(completedKhSetId, "plan_ready",
    `Round ${completedIterations} analysis complete. Strategy ready for Round ${nextIteration}. Auto-starting in 30 seconds...`,
    {
      strategyForNext: analysis?.strategyForNext ?? "",
      learnings: analysis?.learnings ?? [],
      nextIteration,
    });

  // Pipeline pauses here. Client-side timer or user action calls
  // POST /api/campaigns/[id]/continue to generate next KH set and submit.
}

/**
 * Continue to the next discovery round. Called by the client after the 30s
 * approval timer expires or user clicks "Start Now".
 */
export async function continueToNextRound(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      khSets: { orderBy: { createdAt: "asc" }, include: { _count: { select: { results: true } } } },
      documents: true,
      iterations: { orderBy: { iterationNumber: "asc" } },
    },
  });

  if (!campaign) throw new Error("Campaign not found");
  const allowedStatuses = ["awaiting_approval", "failed", "completed", "aborted"];
  if (!allowedStatuses.includes(campaign.status)) {
    throw new Error(`Campaign is in "${campaign.status}" status — cannot continue while active`);
  }

  const completedSets = campaign.khSets.filter((s) => s.status === "completed");
  const totalLeads = completedSets.reduce((sum, s) => sum + s._count.results, 0);
  const nextIteration = completedSets.length + 1;
  const lastKhSet = completedSets[completedSets.length - 1];
  const lastIteration = campaign.iterations[campaign.iterations.length - 1];

  if (!lastKhSet) throw new Error("No completed KH set found");

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "iterating" } });
  await publishDiscoveryEvent(lastKhSet.id, "iteration_preparing",
    `Generating keywords for Round ${nextIteration}...`);

  const allPreviousKeywords = campaign.khSets.flatMap((s) => s.keywords);
  const allPreviousHashtags = campaign.khSets.flatMap((s) => s.hashtags);
  const allLearnings = campaign.iterations.flatMap((i) => i.learnings);

  const defaultExclusions: ExclusionPatterns = {
    themePatterns: [], followerCeiling: null, handlePatterns: [], lowFitThemes: [], collaboratabilityFlags: [],
  };

  const strategyContext: StrategyContext = {
    topPerformingKeywords: lastIteration?.topPerformingKeywords ?? [],
    lowPerformingKeywords: lastIteration?.lowPerformingKeywords ?? [],
    exclusionPatterns: (lastIteration?.exclusionPatterns as unknown as ExclusionPatterns) ?? defaultExclusions,
    strategyRecommendation: lastIteration?.strategyForNext ?? "",
    accumulatedLearnings: allLearnings,
    avgFitScoreByIteration: campaign.iterations.map((i) => i.avgFitScore),
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
        topCreatorThemes: lastIteration
          ? Object.keys((lastIteration.contentThemeFrequency as Record<string, number>) ?? {}).slice(0, 15)
          : [],
        topHashtagsFromContent: [],
      },
      strategyContext,
    });

    await publishDiscoveryEvent(lastKhSet.id, "iteration_started",
      `Round ${nextIteration} started — ${newSet.keywords.length} keywords, ${newSet.hashtags.length} hashtags`);

    await submitKHSetToN8n(campaignId, newSet.id);
  } catch (err) {
    console.error("[discovery-loop] Continue failed:", err);
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "failed" } });
    throw err;
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

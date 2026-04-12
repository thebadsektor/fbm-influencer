import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { llmGenerate, parseJsonFromLLM, type LLMProvider } from "@/lib/llm";
import { resolveApiKey } from "@/lib/credential-resolver";
import { publishDiscoveryEvent } from "@/lib/redis";
import type { CampaignContext, ProfilingResult, AffinityProfile } from "@/lib/affinity-profiler";

// ── Types ──

export interface ExclusionPatterns {
  themePatterns: string[];
  followerCeiling: number | null;
  handlePatterns: string[];
  lowFitThemes: string[];
  collaboratabilityFlags: string[];
}

interface PriorIteration {
  iterationNumber: number;
  keywordsUsed: string[];
  hashtagsUsed: string[];
  avgFitScore: number | null;
  topPerformingKeywords: string[];
  lowPerformingKeywords: string[];
  learnings: string[];
  strategyForNext: string | null;
  exclusionPatterns: unknown;
}

export interface IterationAnalysis {
  topPerformingKeywords: string[];
  lowPerformingKeywords: string[];
  exclusionPatterns: ExclusionPatterns;
  contentThemeFrequency: Record<string, number>;
  analysisNarrative: string;
  strategyForNext: string;
  learnings: string[];
}

// ── Main Function ──

/**
 * Analyze a completed iteration: what worked, what didn't, what to do next.
 * Single LLM call that digests profiling results and produces strategy.
 */
export async function analyzeIteration(
  campaignId: string,
  khSetId: string,
  profilingResult: ProfilingResult,
  campaignContext: CampaignContext,
  currentKeywords: string[],
  currentHashtags: string[],
  previousIterations: PriorIteration[],
  options?: {
    provider?: LLMProvider;
    userId?: string;
  }
): Promise<IterationAnalysis> {
  const provider = options?.provider ?? "openai";
  const apiKey = options?.userId
    ? await resolveApiKey(options.userId, provider)
    : undefined;

  await publishDiscoveryEvent(khSetId, "analysis_started", "Analyzing iteration results...");

  // Load profiled results for this KH set
  const profiledResults = await prisma.result.findMany({
    where: {
      khSetId,
      NOT: { affinityProfile: { equals: Prisma.DbNull } },
    },
    select: {
      creatorName: true,
      creatorHandle: true,
      platform: true,
      followers: true,
      hashtags: true,
      affinityProfile: true,
      campaignFitScore: true,
    },
  });

  // Build creator summary for the LLM
  const highFit = profiledResults.filter((r) => (r.campaignFitScore ?? 0) >= 60);
  const lowFit = profiledResults.filter((r) => (r.campaignFitScore ?? 0) < 30);
  const uncollaboratable = profiledResults.filter((r) => {
    const profile = r.affinityProfile as unknown as AffinityProfile | null;
    return profile?.collaboratability?.score !== undefined && profile.collaboratability.score < 20;
  });

  const highFitSummary = highFit.slice(0, 15).map((r) => {
    const p = r.affinityProfile as unknown as AffinityProfile;
    return `@${r.creatorHandle} (fit:${r.campaignFitScore}, themes:${p.content_themes?.join(",")}, collab:${p.collaboratability?.score})`;
  }).join("\n");

  const lowFitSummary = lowFit.slice(0, 10).map((r) => {
    const p = r.affinityProfile as unknown as AffinityProfile;
    return `@${r.creatorHandle} (fit:${r.campaignFitScore}, themes:${p.content_themes?.join(",")}, flags:${p.collaboratability?.flags?.join(",") || "none"})`;
  }).join("\n");

  const uncollaboratableSummary = uncollaboratable.slice(0, 10).map((r) => {
    const p = r.affinityProfile as unknown as AffinityProfile;
    return `@${r.creatorHandle} (${r.followers} followers, flags:${p.collaboratability?.flags?.join(",")}, reason:${p.collaboratability?.reason})`;
  }).join("\n");

  // Previous iterations context
  const priorContext = previousIterations.map((i) =>
    `Round ${i.iterationNumber}: ${i.keywordsUsed.length} keywords, avg fit ${i.avgFitScore ?? "?"}/100. ` +
    `Top: ${i.topPerformingKeywords.slice(0, 5).join(", ")}. ` +
    `Learnings: ${i.learnings.slice(0, 3).join("; ")}`
  ).join("\n");

  const prompt = `You are a campaign intelligence analyst. Analyze the results of a discovery round and provide strategic recommendations.

CAMPAIGN BRIEF:
- Campaign: ${campaignContext.name}
- Goal: ${campaignContext.marketingGoal}
- Brand/Niche: ${campaignContext.brandNiche}
- Target Audience: ${campaignContext.targetAudienceAge}
- Interests: ${campaignContext.audienceInterests.join(", ") || "General"}

THIS ROUND'S KEYWORDS: ${currentKeywords.join(", ")}
THIS ROUND'S HASHTAGS: ${currentHashtags.join(", ")}

PROFILING RESULTS:
- Total profiled: ${profilingResult.profiledCount}
- Skipped (no data): ${profilingResult.skippedCount}
- Average campaign fit score: ${profilingResult.avgFitScore}/100
- Fit distribution: ${JSON.stringify(profilingResult.fitDistribution)}
- Top content themes: ${JSON.stringify(profilingResult.contentThemeFrequency)}

HIGH-FIT CREATORS (fit >= 60):
${highFitSummary || "None found this round"}

LOW-FIT CREATORS (fit < 30):
${lowFitSummary || "None"}

UNCOLLABORATABLE CREATORS (news networks, mega-celebrities, corporate):
${uncollaboratableSummary || "None detected"}

${priorContext ? `PREVIOUS ITERATIONS:\n${priorContext}` : "This is the first iteration."}

Analyze this round and respond with JSON only:

{
  "topPerformingKeywords": [<keywords from this round that produced high-fit creators, max 10>],
  "lowPerformingKeywords": [<keywords that produced mostly low-fit or uncollaboratable creators, max 10>],
  "recommendedHashtags": [<10-15 NEW hashtags to try in the next round, based on what themes/topics resonated with high-fit creators>],
  "exclusionPatterns": {
    "themePatterns": [<content themes to AVOID in future searches>],
    "followerCeiling": <number or null — if mega-celebrities are polluting, suggest a max follower count>,
    "handlePatterns": [<handle substrings that indicate uncollaboratable accounts, e.g. "news", "official">],
    "lowFitThemes": [<themes that correlate with low campaign fit>],
    "collaboratabilityFlags": [<flags that appeared most in uncollaboratable creators>]
  },
  "analysisNarrative": "<3-5 sentences explaining what happened this round, what worked, what didn't, in plain English>",
  "strategyForNext": "<2-3 sentences recommending what the next round should do differently — which direction to explore, what to avoid, any parameter changes>",
  "learnings": [<3-5 bullet-point learnings from this round, each max 15 words>]
}`;

  const text = await llmGenerate(provider, prompt, 2048, apiKey);
  const analysis = parseJsonFromLLM<IterationAnalysis>(text);

  // Merge with computed theme frequency
  analysis.contentThemeFrequency = {
    ...profilingResult.contentThemeFrequency,
    ...analysis.contentThemeFrequency,
  };

  await publishDiscoveryEvent(khSetId, "analysis_completed",
    `Analysis complete — Avg fit: ${profilingResult.avgFitScore}/100. ${analysis.learnings[0] || ""}`,
    { avgFitScore: profilingResult.avgFitScore, learningsCount: analysis.learnings.length }
  );

  return analysis;
}

import prisma from "@/lib/prisma";
import { llmGenerate, parseJsonFromLLM, LLMProvider } from "@/lib/llm";
import { resolveApiKey } from "@/lib/credential-resolver";
import type { ExclusionPatterns } from "@/lib/iteration-analyzer";

export interface StrategyContext {
  topPerformingKeywords: string[];
  lowPerformingKeywords: string[];
  exclusionPatterns: ExclusionPatterns;
  strategyRecommendation: string;
  accumulatedLearnings: string[];
  avgFitScoreByIteration: (number | null)[];
}

export interface KHGenerationParams {
  campaignId: string;
  campaign: {
    name: string;
    marketingGoal: string;
    brandNiche: string;
    targetAudienceAge: string;
    targetLocation: string[];
    audienceInterests: string[];
    minFollowers: string;
    trendingTopics: string | null;
    competitorBrands: string | null;
    additionalKeywords: string | null;
  };
  documentContents: string[];
  minKeywords: number;
  maxKeywords: number;
  minHashtags: number;
  maxHashtags: number;
  provider: LLMProvider;
  userId?: string;
  // Iteration context
  iterationNumber?: number;
  previousKeywords?: string[];
  previousHashtags?: string[];
  previousResults?: {
    creatorsFound: number;
    topCreatorThemes: string[];
    topHashtagsFromContent: string[];
  };
  // Strategy intelligence (from iteration analyzer)
  strategyContext?: StrategyContext;
}

/**
 * Generate a keyword/hashtag set using an LLM and save it to the database.
 */
export async function generateKHSet(params: KHGenerationParams) {
  const {
    campaignId,
    campaign,
    documentContents,
    minKeywords,
    maxKeywords,
    minHashtags,
    maxHashtags,
    provider,
    userId,
    iterationNumber,
    previousKeywords,
    previousHashtags,
    previousResults,
    strategyContext,
  } = params;

  const docContext = documentContents.filter(Boolean).join("\n\n---\n\n");
  const isIteration = iterationNumber && iterationNumber > 1;

  let iterationContext = "";
  if (isIteration && previousKeywords?.length) {
    iterationContext = `
ITERATION CONTEXT (Round ${iterationNumber}):
This is NOT the first run. Previous rounds already used these keywords and hashtags.
You MUST generate ENTIRELY DIFFERENT ones — do not repeat any.

Previously used keywords: ${previousKeywords.join(", ")}
Previously used hashtags: ${previousHashtags?.join(", ") || "none"}
Creators found so far: ${previousResults?.creatorsFound || 0}
${previousResults?.topCreatorThemes?.length ? `Top themes from discovered creators: ${previousResults.topCreatorThemes.join(", ")}` : ""}
${previousResults?.topHashtagsFromContent?.length ? `Popular hashtags in scraped content: ${previousResults.topHashtagsFromContent.join(", ")}` : ""}`;
  }

  // Strategy intelligence section (from iteration analyzer)
  let strategySection = "";
  if (strategyContext) {
    const sc = strategyContext;
    const fitTrend = sc.avgFitScoreByIteration.filter(Boolean).map((s, i) => `R${i + 1}:${s}`).join(" → ");

    strategySection = `
STRATEGY INTELLIGENCE (from AI analysis of prior rounds):
${fitTrend ? `Fit score trend: ${fitTrend}` : ""}
${sc.topPerformingKeywords.length ? `High-performing keywords (produced fit>60 creators): ${sc.topPerformingKeywords.join(", ")}` : ""}
${sc.lowPerformingKeywords.length ? `Low-performing keywords (produced fit<30, AVOID similar): ${sc.lowPerformingKeywords.join(", ")}` : ""}

EXCLUSION PATTERNS (DO NOT generate keywords that would find these types):
${sc.exclusionPatterns.themePatterns.length ? `- Avoid themes: ${sc.exclusionPatterns.themePatterns.join(", ")}` : ""}
${sc.exclusionPatterns.handlePatterns.length ? `- Avoid channels matching: ${sc.exclusionPatterns.handlePatterns.join(", ")}` : ""}
${sc.exclusionPatterns.lowFitThemes.length ? `- Low-fit themes: ${sc.exclusionPatterns.lowFitThemes.join(", ")}` : ""}
${sc.exclusionPatterns.followerCeiling ? `- Suggested follower ceiling: ${sc.exclusionPatterns.followerCeiling.toLocaleString()}` : ""}

STRATEGY RECOMMENDATION:
${sc.strategyRecommendation}

ACCUMULATED LEARNINGS:
${sc.accumulatedLearnings.slice(-10).map(l => `- ${l}`).join("\n")}

INSTRUCTIONS: Generate keywords that LEAN INTO what worked and AVOID what didn't.
Do NOT generate keywords similar to the low-performing ones.
Explore ADJACENT niches that the high-performing keywords suggest.
The goal is to find NEW collaboratable creators, not news networks or mega-celebrities.`;
  }

  const prompt = `You are an influencer marketing specialist. Generate keywords and hashtags for finding TikTok and YouTube creators matching this campaign brief.

Campaign:
- Name: ${campaign.name}
- Marketing Goal: ${campaign.marketingGoal}
- Brand/Niche: ${campaign.brandNiche}
- Target Audience Age: ${campaign.targetAudienceAge}
- Target Location: ${campaign.targetLocation.join(", ")}
- Audience Interests: ${campaign.audienceInterests.join(", ")}
- Min Followers: ${campaign.minFollowers}
- Trending Topics: ${campaign.trendingTopics || "N/A"}
- Competitor Brands: ${campaign.competitorBrands || "N/A"}
- Additional Keywords: ${campaign.additionalKeywords || "N/A"}

${docContext ? `Context Documents:\n${docContext}` : ""}
${iterationContext}
${strategySection}

CRITICAL: Generate EXACTLY ${maxKeywords} search keywords and EXACTLY ${maxHashtags} hashtags (with # prefix). Do NOT generate fewer — the full count is required for the discovery system to work properly. Each keyword should be 1-4 words. Each hashtag must start with #.

Return ONLY valid JSON in this exact format, no other text:
{"keywords": ["keyword1", "keyword2", ...${maxKeywords} total], "hashtags": ["#hashtag1", "#hashtag2", ...${maxHashtags} total]}`;

  const apiKey = userId ? await resolveApiKey(userId, provider) : undefined;
  const text = await llmGenerate(provider, prompt, 2048, apiKey);
  const parsed = parseJsonFromLLM<{ keywords: string[]; hashtags: string[] }>(text);

  const khSet = await prisma.kHSet.create({
    data: {
      campaignId,
      keywords: parsed.keywords,
      hashtags: parsed.hashtags,
      iterationNumber: iterationNumber || 1,
    },
  });

  return khSet;
}

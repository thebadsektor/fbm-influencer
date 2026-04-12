import prisma from "@/lib/prisma";
import { llmGenerate, parseJsonFromLLM, LLMProvider } from "@/lib/llm";
import { resolveApiKey } from "@/lib/credential-resolver";

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
  // Iteration context — provided for 2nd+ rounds
  iterationNumber?: number;
  previousKeywords?: string[];
  previousHashtags?: string[];
  previousResults?: {
    creatorsFound: number;
    topCreatorThemes: string[];
    topHashtagsFromContent: string[];
  };
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
${previousResults?.topHashtagsFromContent?.length ? `Popular hashtags in scraped content: ${previousResults.topHashtagsFromContent.join(", ")}` : ""}

Strategy: Use the themes and hashtags found in scraped content as INSPIRATION for new search terms.
Explore adjacent niches, related topics, and alternative phrasing.
The goal is to find NEW creators, not the same ones again.`;
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

Generate ${minKeywords}-${maxKeywords} search keywords and ${minHashtags}-${maxHashtags} hashtags (with # prefix) that would be effective for finding relevant influencers on TikTok and YouTube.

Return ONLY valid JSON in this exact format, no other text:
{"keywords": ["keyword1", "keyword2"], "hashtags": ["#hashtag1", "#hashtag2"]}`;

  const apiKey = userId ? await resolveApiKey(userId, provider) : undefined;
  const text = await llmGenerate(provider, prompt, 1024, apiKey);
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

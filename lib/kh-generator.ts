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
  } = params;

  const docContext = documentContents.filter(Boolean).join("\n\n---\n\n");

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
    },
  });

  return khSet;
}

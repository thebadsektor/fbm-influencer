import prisma from "@/lib/prisma";
import { llmGenerate, parseJsonFromLLM, type LLMProvider } from "@/lib/llm";
import { resolveApiKey } from "@/lib/credential-resolver";
import { publishDiscoveryEvent } from "@/lib/redis";

// ── Types ──

export interface CampaignContext {
  name: string;
  marketingGoal: string;
  brandNiche: string;
  targetAudienceAge: string;
  targetLocation: string[];
  audienceInterests: string[];
}

export interface AffinityProfile {
  political: {
    alignment: number; // 1=far-left, 5=center, 10=far-right
    authenticity: number; // 0=satirical, 1=genuine
    activism_level: string; // none, low, moderate, high
  };
  content_themes: string[];
  audience_signals: {
    age_bracket: string;
    geo_signal: string;
    language: string;
  };
  creator_quality: {
    engagement_organic: boolean;
    content_consistency: string;
    brand_safe: boolean;
    posting_frequency: string;
  };
  collaboratability: {
    score: number; // 0-100, where 0 = uncollaboratable (news network, mega celebrity)
    reason: string;
    flags: string[]; // e.g. ["news_network", "mega_celebrity", "corporate_account"]
  };
  summary: string;
  raw_themes_detected: string[];
  campaignFitScore: number; // 0-100, how well they fit THIS campaign
  campaignFitReason: string;
}

interface ResultForProfiling {
  id: string;
  platform: string;
  platformId: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  bio: string | null;
  rawText: string | null;
  hashtags: string | null;
  followers: string | null;
  engagementRate: string | null;
}

export interface ProfilingResult {
  profiledCount: number;
  skippedCount: number;
  avgFitScore: number;
  fitDistribution: Record<string, number>;
  contentThemeFrequency: Record<string, number>;
  errors: number;
  cost: number;
  durationMs: number;
}

// ── Concurrency Limiter ──

function createLimiter(concurrency: number) {
  let running = 0;
  const queue: (() => void)[] = [];

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    while (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

// ── Prompt Builder ──

function buildProfilingPrompt(
  result: ResultForProfiling,
  campaign: CampaignContext,
  exclusionPatterns?: Record<string, unknown>
): string {
  const platform = result.platform || "unknown";
  const handle = result.creatorHandle || "unknown";
  const name = result.creatorName || "unknown";
  const bio = result.bio || "N/A";
  const rawText = result.rawText || bio;
  const hashtags = result.hashtags || "";
  const followers = result.followers || "0";

  const creatorProfile = `@${handle} (${name}) [${platform}]
  Bio: ${bio}
  Followers: ${followers}
  Hashtags: ${hashtags}
  Full Content Dump:
${rawText}`;

  const exclusionSection = exclusionPatterns
    ? `\nKNOWN EXCLUSION PATTERNS (from prior analysis):
${JSON.stringify(exclusionPatterns, null, 2)}
Flag this creator if they match any of these patterns.`
    : "";

  return `You are a creator profiling system. Analyze this ${platform} creator and produce a structured Affinity Profile.

CAMPAIGN BRIEF:
- Campaign: ${campaign.name}
- Goal: ${campaign.marketingGoal}
- Brand/Niche: ${campaign.brandNiche}
- Target Audience: ${campaign.targetAudienceAge}
- Target Location: ${campaign.targetLocation.join(", ")}
- Interests: ${campaign.audienceInterests.join(", ") || "General"}

Creator Profile:
${creatorProfile}
${exclusionSection}

Respond with JSON only. Follow this exact schema:

{
  "political": {
    "alignment": <number 1-10, 1=far-left, 5=center, 10=far-right>,
    "authenticity": <number 0-1, 0=satirical/ironic, 1=genuine>,
    "activism_level": "<none|low|moderate|high>"
  },
  "content_themes": [<up to 8 theme strings>],
  "audience_signals": {
    "age_bracket": "<13-17|18-24|25-34|35-44|45-54|55+|unknown>",
    "geo_signal": "<country-region or 'unknown'>",
    "language": "<2-letter ISO code>"
  },
  "creator_quality": {
    "engagement_organic": <boolean>,
    "content_consistency": "<low|moderate|high>",
    "brand_safe": <boolean>,
    "posting_frequency": "<daily|weekly|monthly|irregular|unknown>"
  },
  "collaboratability": {
    "score": <0-100, where 100=ideal micro-influencer, 0=news network or uncollaboratable>,
    "reason": "<1 sentence why they can or cannot collaborate>",
    "flags": [<any of: "news_network", "mega_celebrity", "corporate_account", "parody_account", "inactive", "bot_suspected">]
  },
  "summary": "<1-2 sentence factual summary>",
  "raw_themes_detected": [<all detected topic keywords, lowercase, up to 15>],
  "campaignFitScore": <0-100, how well this creator fits the campaign brief above>,
  "campaignFitReason": "<1 sentence explaining the fit score>"
}

Rules:
- Be PRECISE with political.alignment. Mocking a position is NOT supporting it.
- collaboratability.score: 0 for major news networks, corporate accounts, mega-celebrities (10M+ followers). 50-100 for creators who actually collaborate with brands.
- campaignFitScore: considers BOTH content alignment AND collaboratability. A perfect content match that's a news network still scores low.
- If you can't determine a value, use the most neutral/unknown option.
- JSON only. No markdown, no explanation.`;
}

// ── Main Function ──

/**
 * Profile a batch of creators with GPT, writing affinityProfile + campaignFitScore
 * to each Result record. Skips results with no rawText AND no bio.
 */
export async function profileBatch(
  results: ResultForProfiling[],
  campaignContext: CampaignContext,
  options?: {
    concurrency?: number;
    provider?: LLMProvider;
    userId?: string;
    khSetId?: string; // for Redis events
    exclusionPatterns?: Record<string, unknown>;
  }
): Promise<ProfilingResult> {
  const startTime = Date.now();
  const concurrency = options?.concurrency ?? 10;
  const provider = options?.provider ?? "openai";
  const limit = createLimiter(concurrency);

  // Filter out empties
  const profilable = results.filter(
    (r) => (r.rawText && r.rawText.trim().length > 10) || (r.bio && r.bio.trim().length > 5)
  );
  const skippedCount = results.length - profilable.length;

  if (options?.khSetId) {
    await publishDiscoveryEvent(options.khSetId, "profiling_started",
      `Profiling ${profilable.length} creators (${skippedCount} skipped — insufficient data)`,
      { total: profilable.length, skipped: skippedCount }
    );
  }

  const apiKey = options?.userId
    ? await resolveApiKey(options.userId, provider)
    : undefined;

  // Profile in parallel
  let profiledCount = 0;
  let errors = 0;
  const fitScores: number[] = [];
  const themeCounter = new Map<string, number>();

  const tasks = profilable.map((result) =>
    limit(async () => {
      try {
        const prompt = buildProfilingPrompt(result, campaignContext, options?.exclusionPatterns);
        const text = await llmGenerate(provider, prompt, 1024, apiKey);
        const profile = parseJsonFromLLM<AffinityProfile>(text);

        // Validate minimum structure
        if (!profile.political || typeof profile.campaignFitScore !== "number") {
          throw new Error("Invalid profile structure");
        }

        // Write to DB
        await prisma.result.update({
          where: { id: result.id },
          data: {
            affinityProfile: JSON.parse(JSON.stringify(profile)),
            campaignFitScore: profile.campaignFitScore,
          },
        });

        fitScores.push(profile.campaignFitScore);
        for (const theme of profile.content_themes || []) {
          themeCounter.set(theme, (themeCounter.get(theme) || 0) + 1);
        }
        profiledCount++;

        // Progress event every 5 creators
        if (options?.khSetId && profiledCount % 5 === 0) {
          await publishDiscoveryEvent(options.khSetId, "profiling_progress",
            `Profiled ${profiledCount}/${profilable.length} — @${result.creatorHandle || "?"} (fit: ${profile.campaignFitScore})`,
            { current: profiledCount, total: profilable.length }
          );
        }
      } catch (err) {
        errors++;
        console.error(`[profiler] Error profiling ${result.creatorHandle}:`, err);
      }
    })
  );

  await Promise.all(tasks);

  // Compute aggregates
  const avgFitScore = fitScores.length > 0
    ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length)
    : 0;

  const fitDistribution: Record<string, number> = {
    "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0,
  };
  for (const score of fitScores) {
    if (score <= 20) fitDistribution["0-20"]++;
    else if (score <= 40) fitDistribution["21-40"]++;
    else if (score <= 60) fitDistribution["41-60"]++;
    else if (score <= 80) fitDistribution["61-80"]++;
    else fitDistribution["81-100"]++;
  }

  const contentThemeFrequency = Object.fromEntries(
    [...themeCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
  );

  const durationMs = Date.now() - startTime;
  const estimatedCost = profiledCount * 0.001; // ~$0.001 per GPT-4o-mini call

  if (options?.khSetId) {
    await publishDiscoveryEvent(options.khSetId, "profiling_completed",
      `Profiling complete — ${profiledCount} profiled, avg fit: ${avgFitScore}/100, ${errors} errors`,
      { profiledCount, skippedCount, avgFitScore, errors, durationMs }
    );
  }

  return {
    profiledCount,
    skippedCount,
    avgFitScore,
    fitDistribution,
    contentThemeFrequency,
    errors,
    cost: estimatedCost,
    durationMs,
  };
}

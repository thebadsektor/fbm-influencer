import { z } from "zod";

// ── Campaign ───────────────────────────────────────────

export const campaignCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  marketingGoal: z.string().min(1),
  brandNiche: z.string().min(1),
  targetAudienceAge: z.string().min(1),
  targetLocation: z.array(z.string()).min(1),
  audienceInterests: z.array(z.string()).min(1),
  minFollowers: z.string().min(1),
  minEngagementRate: z.number().min(0).max(100).default(3),
  numberOfInfluencers: z.number().int().min(1).max(500).default(25),
  targetKeywords: z.number().int().min(1).max(50).default(5),
  targetHashtags: z.number().int().min(1).max(50).default(5),
  trendingTopics: z.string().nullish(),
  competitorBrands: z.string().nullish(),
  additionalKeywords: z.string().nullish(),
  // Optional document fields (from analyze-document flow)
  documentContent: z.string().optional(),
  documentFilename: z.string().optional(),
  documentMimeType: z.string().optional(),
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
});

export const campaignPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  marketingGoal: z.string().optional(),
  brandNiche: z.string().optional(),
  targetAudienceAge: z.string().optional(),
  targetLocation: z.array(z.string()).optional(),
  audienceInterests: z.array(z.string()).optional(),
  minFollowers: z.string().optional(),
  minEngagementRate: z.number().min(0).max(100).optional(),
  numberOfInfluencers: z.number().int().min(1).max(500).optional(),
  targetKeywords: z.number().int().min(1).max(50).optional(),
  targetHashtags: z.number().int().min(1).max(50).optional(),
  trendingTopics: z.string().nullish(),
  competitorBrands: z.string().nullish(),
  additionalKeywords: z.string().nullish(),
  status: z.string().optional(),
});

// ── KH Sets ────────────────────────────────────────────

export const khSetGenerateSchema = z.object({
  minKeywords: z.number().int().min(1).max(50).optional(),
  maxKeywords: z.number().int().min(1).max(50).optional(),
  minHashtags: z.number().int().min(1).max(50).optional(),
  maxHashtags: z.number().int().min(1).max(50).optional(),
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
});

export const khSetPatchSchema = z.object({
  keywords: z.array(z.string()).optional(),
  hashtags: z.array(z.string()).optional(),
});

export const khSetSubmitSchema = z.object({
  platform: z.enum(["youtube", "tiktok", "both"]).default("both"),
  testMode: z.boolean().default(false),
});

// ── Credentials ────────────────────────────────────────

export const credentialCreateSchema = z.object({
  serviceType: z.string().min(1),
  provider: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
});

export const credentialPatchSchema = z.object({
  label: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// ── Webhooks ───────────────────────────────────────────

export const n8nCallbackSchema = z.object({
  khSetId: z.string().min(1, "Missing khSetId"),
  platform: z.string().optional(),
  results: z.array(z.any()).optional(),
  error: z.string().optional(),
});

export const n8nStatsSyncSchema = z.object({
  khSetId: z.string().min(1, "Missing khSetId"),
  totalScraped: z.number().int().nonnegative().optional(),
  qualified: z.number().int().nonnegative().optional(),
  missingEmail: z.number().int().nonnegative().optional(),
  enriched: z.number().int().nonnegative().optional(),
  leadPoolUrl: z.string().url().optional(),
  extraStats: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

// ── Helper ─────────────────────────────────────────────

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: string };

/**
 * Parse and validate a request body with a Zod schema.
 * Returns { success: true, data } on success, { success: false, error } on failure.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): ParseSuccess<T> | ParseFailure {
  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: messages };
  }
  return { success: true, data: result.data };
}

export const MARKETING_GOALS = [
  "Lead Generation",
  "Awareness",
  "Brand Awareness",
  "Conversions",
  "UGC",
] as const;

export const AGE_RANGES = [
  "18-24 (Gen Z)",
  "25-34 (Millennials)",
  "35-54",
  "55+",
] as const;

export const LOCATIONS = ["US", "Global", "UK", "Canada", "Asia"] as const;

export const INTERESTS = [
  "Health & Fitness",
  "Beauty & Skincare",
  "Tech & Gadgets",
  "Finance & Investing",
  "Food & Cooking",
  "Travel & Adventure",
  "Fashion & Style",
  "Gaming",
  "Education & Learning",
  "Home & DIY",
  "Parenting & Family",
  "Entertainment & Pop Culture",
  "Sports",
  "Business & Entrepreneurship",
  "Sustainability & Eco",
  "Pets & Animals",
  "Music",
  "Art & Design",
  "Automotive",
  "Politics & Activism",
] as const;

export const FOLLOWER_TIERS = ["1K", "10K", "50K", "100K", "1M+"] as const;

export const KH_STATUSES = {
  DRAFT: "draft",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

/**
 * Enrichment workflows that run automatically after AI Profiling.
 * Add new workflows here to extend the enrichment pipeline.
 */
export const ENRICHMENT_WORKFLOWS = [
  {
    id: "youtube-email-scraper",
    label: "YouTube Email",
    platform: "YOUTUBE",
    minBatch: 25,
    webhookPath: "7cc825b0-c452-4c3f-acc3-ee8bc72bcd40",
    costPerResult: 0.12,
    platformIdPrefix: "UC", // YouTube channel IDs start with UC
  },
  {
    id: "tiktok-linktree-scraper",
    label: "TikTok Linktree",
    platform: "TIKTOK",
    minBatch: 10,
    webhookPath: "30ac38e5-2287-4a09-8249-915ef0088546",
    costPerResult: 0.005,
    platformIdPrefix: "",
    inputType: "crawlTargets",
  },
] as const;

export const CAMPAIGN_STATUSES = {
  DRAFT: "draft",
  SCOUTING: "scouting",
  OUTREACH: "outreach",
  NEGOTIATION: "negotiation",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

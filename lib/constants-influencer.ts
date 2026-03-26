export const MARKETING_GOALS = [
  "Awareness",
  "Conversions",
  "UGC",
  "Brand Awareness",
  "Lead Gen",
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

export const CAMPAIGN_STATUSES = {
  DRAFT: "draft",
  SCOUTING: "scouting",
  OUTREACH: "outreach",
  NEGOTIATION: "negotiation",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

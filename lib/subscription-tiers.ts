export type SubscriptionTier = "free" | "plus" | "enterprise";

export interface TierConfig {
  label: string;
  platformLlmProviders: readonly string[];
  maxCampaigns: number; // -1 = unlimited
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    label: "Free",
    platformLlmProviders: [],
    maxCampaigns: 3,
  },
  plus: {
    label: "Plus",
    platformLlmProviders: ["openai"],
    maxCampaigns: 25,
  },
  enterprise: {
    label: "Enterprise",
    platformLlmProviders: ["anthropic", "openai", "gemini"],
    maxCampaigns: -1,
  },
};

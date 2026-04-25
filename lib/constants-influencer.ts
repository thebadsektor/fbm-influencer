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
 *
 * Three runners are supported:
 *   - "n8n":              POST to an n8n webhook; results arrive async via callback.
 *                         Used for Apify actors. Requires `webhookPath`.
 *   - "server":           Synchronous Node function running in this Next.js process.
 *                         Free, fastest, but blocks the request handler. Used for
 *                         pure regex/text extraction. Requires `handler`.
 *   - "external-service": Synchronous POST to a separate Railway-deployed worker
 *                         (see fbm-scraper-worker repo). Used for fetch-heavy
 *                         scraping (biolinks, websites). Requires `servicePath`
 *                         and the SCRAPER_SERVICE_URL env var on this app.
 *
 * `dependsOn` enforces a cost-ascending cascade: a workflow only runs against a
 * Result once every workflow listed in dependsOn has reached completed/empty for
 * that Result. Lets free workflows fire first, paid ones last.
 */
export type EnrichmentWorkflowRunner = "n8n" | "server" | "external-service";

export type EnrichmentWorkflow = {
  id: string;
  label: string;
  platform: "YOUTUBE" | "TIKTOK" | "ALL";
  minBatch: number;
  costPerResult: number;
  runner: EnrichmentWorkflowRunner;
  /** n8n webhook UUID — only for runner: "n8n" */
  webhookPath?: string;
  /** handler module name in lib/enrichment-handlers/ — only for runner: "server" */
  handler?: string;
  /** path on the external scraper service — only for runner: "external-service" */
  servicePath?: string;
  /** YouTube channels start with "UC"; empty string skips this filter */
  platformIdPrefix?: string;
  /** What field on Result feeds the workflow's input */
  inputType?: "platformId" | "crawlTargets" | "domain";
  /** Workflow ids that must reach completed/empty before this one is eligible */
  dependsOn?: string[];
};

export const ENRICHMENT_WORKFLOWS: readonly EnrichmentWorkflow[] = [
  // ─── Tier 1: free in-process regex ──────────────────────────────────────
  {
    id: "bio-email-extractor",
    label: "Bio Regex",
    platform: "ALL",
    minBatch: 1,
    costPerResult: 0,
    runner: "server",
    handler: "bio-email-extractor",
    inputType: "platformId",
    platformIdPrefix: "",
  },

  // ─── Tier 2: free Railway-deployed scraper service ──────────────────────
  {
    id: "biolink-direct",
    label: "Bio-link (direct)",
    platform: "ALL",
    minBatch: 5,
    costPerResult: 0,
    runner: "external-service",
    servicePath: "/scrape",
    inputType: "crawlTargets",
    platformIdPrefix: "",
    dependsOn: ["bio-email-extractor"],
  },

  // ─── Tier 4: existing Apify actors (kept; demoted to last-resort) ───────
  {
    id: "youtube-email-scraper",
    label: "YouTube Email",
    platform: "YOUTUBE",
    minBatch: 25,
    runner: "n8n",
    webhookPath: "7cc825b0-c452-4c3f-acc3-ee8bc72bcd40",
    costPerResult: 0.12,
    platformIdPrefix: "UC",
    dependsOn: ["bio-email-extractor"],
  },
  {
    id: "tiktok-linktree-scraper",
    label: "TikTok Linktree",
    platform: "TIKTOK",
    minBatch: 10,
    runner: "n8n",
    webhookPath: "30ac38e5-2287-4a09-8249-915ef0088546",
    costPerResult: 0.005,
    platformIdPrefix: "",
    inputType: "crawlTargets",
    dependsOn: ["bio-email-extractor", "biolink-direct"],
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

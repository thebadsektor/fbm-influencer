# Enrichment Strategy: Reinforcing Apify, Not Replacing It

## Why this exists

The two existing Apify actors (`dataovercoffee` for YouTube emails at $0.12 and `ahmed_jasarevic` for TikTok Linktree at $0.005) are **cheap on purpose** — that selection is a deliberate cost decision. They're staying.

What we want is **reinforcements**: parallel enrichment paths that run alongside the existing actors so a single Apify hang or empty result doesn't end the pursuit of a creator's email. Two reinforcement classes:

1. **Self-hosted Railway services** — free per-call, run on our own compute, fully observable, no third-party SLA.
2. **Additional Apify actors** — strictly pay-on-success and capped per-result cost, so adding them never causes credit bleed.

Hunter.io / Apollo / Clearbit / RocketReach are explicitly out of scope for now.

## Cost discipline rules for any new Apify actor

Before adding any actor to `ENRICHMENT_WORKFLOWS`, it must pass all three:

1. **Pay-per-result, not pay-per-run.** No subscription, no monthly minimum. The actor's pricing page must read "$X per result" or "$X per successful result."
2. **Per-result cost ≤ $0.01.** Anything above that gets evaluated against expected hit rate; default cap is $0.01.
3. **Pay-on-success preferred.** Actors that only charge when they find something (e.g. `practicaltools/contact-details-scraper`) are strictly safer than ones that charge for every attempt.

Anything failing those rules requires explicit user sign-off before deployment.

## Tiered plan (revised)

### Tier 1 — In-process bio regex (1 hr, $0)
Runs in the Next.js process. Reads `Result.bio` and `Result.rawText`, runs a strict email regex, validates against a denylist of obvious noise (`noreply@`, `donotreply@`, generic role accounts when nothing else matches). Returns first hit.

**File:** `lib/enrichment-handlers/bio-email-extractor.ts`

**ROI:** ~1 hit on current data, but every future scrape passes through this for free first — it's the cheapest possible filter. Catches the trivially-easy cases before any external call fires.

### Tier 2 — Self-hosted **biolink-scraper** Railway service (1 day, $0)

This is the headline move. A small standalone service deployed as its own Railway service.

**What it does:** HTTP endpoint `POST /scrape` that takes `{ urls: string[] }`. For each URL:
1. `fetch(url)` with 8s timeout
2. Parse with `cheerio`
3. Extract emails from `mailto:` hrefs first (high-confidence)
4. Fall back to text-content email regex
5. Return per-URL `{ url, email | null }`

**Stack:** Bun + tiny Express-equivalent (Hono), `cheerio`, `undici` for fetch. ~150 LOC. Deploy from a one-file repo via Railway template.

**Why a separate service vs in the Next.js app:**
- Isolates flaky fetch behavior (timeouts, redirects, weird HTML) from the user-facing app
- Can scale independently (more replicas if backlog grows)
- Easy to swap stacks later (Playwright if JS execution becomes needed) without touching the app
- Crashes don't take the app down

**Coverage:** linktr.ee, beacons.ai, msha.ke, hoo.be, campsite.bio, allmylinks.com, snipfeed.co, milkshake.app — same domain set the current TikTok-Linktree actor covers, plus a few more.

**Reinforces, not replaces:** Existing `tiktok-linktree-scraper` Apify actor stays. Both run in parallel via the dependency cascade (see "Cascade order" below). Service catches the 326 current candidates instantly + zero cost; Apify becomes a backup for the cases the service can't crack.

**Sized opportunity (current DB):** 326 results have a `crawlTargets` URL but no email. Realistic biolink hit rate is 30-50% → **~100-160 new emails free** for this campaign alone.

### Tier 3 — Self-hosted **website-email-scraper** Railway service (2 days, $0)

For Results where `crawlTargets` contains a regular website URL (not a known biolink platform). YouTube channel descriptions sometimes link to a creator's actual website where the contact email lives on the homepage or `/contact` page.

**What it does:** `POST /scrape-domain` takes `{ url, hops: 0..2 }`. Fetches root, looks for `mailto:` and email patterns. If `hops > 0`, fetches up to N internal links matching `/contact`, `/about`, `/press`, `/business`, repeats extraction. Caps total fetches at ~5 per domain.

**Stack:** same service as Tier 2, just a different endpoint. Reuses fetch + cheerio infrastructure.

**Why this beats `gordian/email-extractor` ($3/mo Apify subscription):** Free, full control over crawl depth, returns immediately, no monthly minimum.

**Sized opportunity:** TBD — depends on how many `crawlTargets` are non-biolink URLs. Quick query: rows with crawlTargets that don't match the biolink domain list. Worth running before committing.

### Tier 4 — Apify reinforcement actor: `practicaltools/contact-details-scraper` (½ day, ~$0.005/hit, pay-on-success)

The standout cheap Apify actor for our use case. Per the actor's listing: **$0.0045 per successful result** (charges only when it finds something), and it's a generalist — extracts emails from URLs across YouTube, TikTok, Instagram, LinkedIn, Twitter, Facebook, etc.

**Use case:** when Tiers 1-3 (free) miss but we have a URL (profile URL, website, or biolink), throw it at this actor. Won't cost credits unless it actually returns an email.

Add as a new n8n workflow (`contact-details-fallback`) using the existing n8n + ENRICHMENT_WORKFLOWS infrastructure — no new architecture needed. Just another row in `lib/constants-influencer.ts:54`.

**Why this passes the cost rules:** ✅ pay-per-result ✅ ≤ $0.01 ✅ pay-on-success.

### Tier 5 (optional, future) — Apify reinforcement actor: `anchor/email-phone-extractor`

Generic URL → email/phone extractor described as "very fast and almost free." Useful if we want a third opinion or specifically need phone numbers in addition to emails.

Same gating: confirm pay-per-result + ≤ $0.01 + pay-on-success before adding.

## Architecture: server-side runner

Today `lib/enrichment-runner.ts` only knows how to call n8n. Tiers 1-3 don't need n8n at all. Add a second runner:

```ts
// lib/constants-influencer.ts
type EnrichmentWorkflow = {
  id: string; label: string;
  platform: "YOUTUBE" | "TIKTOK" | "ALL";
  minBatch: number;
  costPerResult: number;
  runner: "n8n" | "server" | "external-service";
  // n8n-only:
  webhookPath?: string;
  // server-only (in-process Node):
  handler?: string;  // ref to lib/enrichment-handlers/*
  // external-service-only (Railway-deployed worker):
  serviceUrl?: string;  // e.g. process.env.BIOLINK_SCRAPER_URL
  servicePath?: string; // e.g. "/scrape"
  // common:
  inputType?: "platformId" | "crawlTargets" | "domain";
  platformIdPrefix?: string;
  dependsOn?: string[]; // workflow ids that must have completed/empty'd first
};
```

Three runners:
- **`n8n`** — current path. Apify actors stay here.
- **`server`** — in-process Node function. Tier 1 (bio regex). Cheapest, but blocks the request thread.
- **`external-service`** — POST to a Railway-deployed worker. Tiers 2-3. Isolated, scalable.

In `lib/enrichment-runner.ts:140`, branch on `workflow.runner` and call the right trigger function. Same `EnrichmentRun` lifecycle, same dashboard, same outreach hand-off.

## Cascade order (reinforcement, not replacement)

Add `dependsOn?: string[]` to the registry. A workflow becomes eligible for a result only after its dependencies have all reached `completed` or `empty` for that result. Keeps free workflows running first, paid ones last:

```
bio-email-extractor (free)
        ↓
biolink-scraper-direct (free, self-hosted)
        ↓
website-email-scraper (free, self-hosted)
        ↓
tiktok-linktree-scraper (Apify, $0.005, EXISTING — stays)
youtube-email-scraper (Apify, $0.12, EXISTING — stays)
contact-details-fallback (Apify, $0.0045, NEW reinforcement)
        ↓
[future paid tiers — opt-in only]
```

Dependencies are AND-gated. Each result moves down the cascade only when every cheaper, free option has been exhausted. Apify actors keep running but only on creators where free workflows didn't yield. Expected outcome: **~50-70% reduction in Apify credit consumption**, plus emails captured for the 326 existing biolink candidates.

## Railway deployment plan for the worker services

The `biolink-scraper` and `website-email-scraper` can live in the same Railway service (they're both HTTP endpoints over the same fetch+cheerio core).

**Repo structure:**
```
fbm-scraper-worker/        # new GitHub repo
├── package.json           # bun, hono, cheerio, undici
├── src/index.ts           # Hono app with /scrape and /scrape-domain
├── src/extract.ts         # email extraction logic
├── Dockerfile             # multi-stage: build + bun runtime
└── railway.toml           # Railway config
```

**Railway setup:**
- New service in the existing `influencer-search` Railway project (alongside `fbm-influencers`)
- Auto-deploy from `main` branch
- Internal Railway DNS: `${{ scraper.RAILWAY_PRIVATE_DOMAIN }}` so the app calls it over the private network
- Add `SCRAPER_SERVICE_URL` env var on `fbm-influencers` pointing at the private DNS

**Resource budget:** smallest Railway tier (~512 MB) is plenty for fetch+cheerio. ~$5/mo per service if we even hit billing thresholds.

**Why deploy on Railway and not as a Vercel function or Next.js API route:**
- 50-100 outbound fetches per batch can easily exceed serverless function limits
- Need persistent process for connection reuse and DNS caching
- Crashes/restarts isolated from the user-facing app
- Easy independent scaling

## Files to create / change

| Path | Action | Owner |
|---|---|---|
| `lib/constants-influencer.ts` | Extend `ENRICHMENT_WORKFLOWS` schema with `runner`, `handler`, `serviceUrl`/`servicePath`, `dependsOn` | App |
| `lib/enrichment-runner.ts` | Branch on `workflow.runner`; add `triggerServerSideEnrichment` and `triggerExternalServiceEnrichment` | App |
| `app/api/campaigns/[id]/enrichment/start/route.ts` | Same branch | App |
| `lib/enrichment-handlers/bio-email-extractor.ts` | **New** — Tier 1 in-process | App |
| `lib/enrichment-handlers/external-service-runner.ts` | **New** — generic POST-to-service helper for Tiers 2-3 | App |
| `fbm-scraper-worker/` | **New repo** — biolink + website-email scraping HTTP service | New repo |
| n8n: new workflow `contact-details-fallback` | **New n8n workflow** wrapping `practicaltools/contact-details-scraper` | n8n |

## Verification approach

1. Build Tier 1 + Tier 2 (worker service deployed, registry extended).
2. Backfill: for the 326 results with `crawlTargets` and the 1,536 with `bio`, fire each through the new free workflows in cascade order.
3. Measure: hit count, false-positive rate (sample 20, manually verify), end-to-end latency.
4. Compare against Apify's historical performance on the same campaign.
5. Add Tier 4 (`contact-details-fallback`) as the last cascade step. Watch Apify credit burn — should fall.

## TL;DR

- **Apify actors stay.** They're cheap, deliberately chosen, and now backstopped.
- **Build a Railway-deployed scraper service** (`fbm-scraper-worker`) that handles biolink + website email extraction. Free per-call, isolated from the app.
- **Add ONE cheap Apify reinforcement** (`practicaltools/contact-details-scraper`, $0.0045 pay-on-success) as a fallback after free workflows.
- **Cascade by cost.** Free first, paid last. Expected Apify credit savings: 50-70%.
- **No Hunter, no Apollo, no monthly subscriptions.** Pay-per-success only.

Sources for the actor research:
- [Contact Details Scraper · Apify](https://apify.com/practicaltools/contact-details-scraper) — $0.0045 pay-on-success
- [Email & Phone Extractor · Apify](https://apify.com/anchor/email-phone-extractor) — "almost free", pay-per-result
- [Email Extractor · Apify](https://apify.com/gordian/email-extractor) — $3/mo subscription (FAILS our cost rules — skip)
- [YouTube Channel Email Extractor · Apify](https://apify.com/dataovercoffee/youtube-channel-business-email-scraper) — current YouTube actor, $0.12
- [Best Apify Actors 2026](https://use-apify.com/docs/best-apify-actors) — actor research hub

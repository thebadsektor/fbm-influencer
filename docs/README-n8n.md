# n8n Workflows

Self-hosted n8n instance on Railway that powers the discovery and enrichment pipelines. The Next.js app communicates with n8n via webhook triggers and receives results via HTTP callback POSTs.

## About

The n8n instance orchestrates all external scraping operations. It receives batched requests from the web app, fans out to Apify actors for the heavy lifting, maps the results back to internal IDs, and POSTs structured callbacks to the app's webhook endpoints. The app never talks to Apify directly — n8n is the integration layer.

**Base URL:** Configured via `N8N_BASE_URL` env var in the web app.

## Workflows

### 1. YouTube Email Enrichment v3

**ID:** `MhNeYUbxWYZPKNT8`
**Webhook path:** `/webhook/7cc825b0-c452-4c3f-acc3-ee8bc72bcd40`
**Apify actor:** `dataovercoffee/Youtube-Channel-Business-Email-Scraper` (Xa3Un5HYidE8VMKZu)
**Cost:** ~$0.12 per channel lookup

**Purpose:** Scrape public business emails from YouTube channel About pages.

**Flow:**
```
Webhook (POST)
  |
  |--> Respond to Webhook (immediate 200)
  |
  |--> Scrape Emails (Apify actor, executeOnce, alwaysOutputData)
         |
         |--> Map Results to App (Code node)
         |      - Maps Apify ChannelId back to enrichmentRunId
         |      - Sets status: 'completed' (email found) or 'empty' (no email)
         |      - Builds resultUpdates: { email, emailSource }
         |
         |--> Callback to App (HTTP POST to callbackUrl)
                - Batched: 10 items per request, 2s interval
                - Endpoint: /api/webhooks/n8n-enrichment
```

**Input payload (from web app):**
```json
{
  "channels": ["UCxxxxx", "UCyyyyy"],
  "enrichmentRunMap": {
    "UCxxxxx": { "enrichmentRunId": "...", "resultId": "..." }
  },
  "callbackUrl": "https://app.example.com/api/webhooks/n8n-enrichment",
  "workflow": "youtube-email-scraper"
}
```

**Callback payload (per item):**
```json
{
  "enrichmentRunId": "...",
  "workflow": "youtube-email-scraper",
  "status": "completed",
  "output": { "email": "creator@gmail.com", "channelId": "UCxxxxx" },
  "resultUpdates": {
    "email": "creator@gmail.com",
    "emailSource": "apify-dataovercoffee"
  }
}
```

When no email is found, `status` is `"empty"` and `output.email` is `null`.

**Node settings to preserve:**
- `Scrape Emails`: `executeOnce: true`, `alwaysOutputData: true`, `retryOnFail: false`
- `Callback to App`: batching enabled (batchSize: 10, batchInterval: 2000ms)

---

### 2. TikTok Linktree Enrichment v2

**ID:** `uNUFyokMbNW7zvvC`
**Webhook path:** `/webhook/30ac38e5-2287-4a09-8249-915ef0088546`
**Apify actor:** `ahmed_jasarevic/linktree-beacons-bio-email-scraper-extract-leads` (3t8Np6SkOtweErTgg)
**Cost:** ~$0.005 per URL lookup

**Purpose:** Scrape emails from TikTok creators' Linktree/Beacons/bio link pages.

**Flow:**
```
Webhook (POST)
  |
  |--> Respond to Webhook (immediate 200)
  |
  |--> Scrape Linktree (Apify actor, executeOnce, alwaysOutputData)
         |
         |--> Map Results to App (Code node)
         |      - Maps Apify URL back to enrichmentRunId via enrichmentRunMap
         |      - Sets status: 'completed' (email found) or 'empty' (no email)
         |      - Extracts first email from emails[] array
         |
         |--> Callback to App (HTTP POST to callbackUrl)
                - Batched: 10 items per request, 2s interval
                - Endpoint: /api/webhooks/n8n-enrichment
```

**Input payload:**
```json
{
  "urls": [{ "url": "https://linktr.ee/creator" }],
  "enrichmentRunMap": {
    "https://linktr.ee/creator": { "enrichmentRunId": "...", "resultId": "..." }
  },
  "callbackUrl": "https://app.example.com/api/webhooks/n8n-enrichment",
  "workflow": "tiktok-linktree-scraper"
}
```

**Callback payload (per item):**
```json
{
  "enrichmentRunId": "...",
  "workflow": "tiktok-linktree-scraper",
  "status": "completed",
  "output": {
    "email": "creator@example.com",
    "url": "https://linktr.ee/creator",
    "allEmails": ["creator@example.com"],
    "socialLinks": []
  },
  "resultUpdates": {
    "email": "creator@example.com",
    "emailSource": "apify-linktree-scraper"
  }
}
```

**Node settings to preserve:**
- `Scrape Linktree`: `executeOnce: true`, `alwaysOutputData: true`, `retryOnFail: false`
- `Callback to App`: batching enabled (batchSize: 10, batchInterval: 2000ms)

---

### 3. Discovery Workflow

Triggered by the web app when a KH Set is submitted for scraping. Scrapes YouTube/TikTok using keywords + hashtags, deduplicates, and sends results back via callback.

**Webhook path:** Configured via `N8N_WEBHOOK_ID` env var in the web app.

**Callback endpoint:** `/api/webhooks/n8n-callback`

Details vary by version as discovery is iterated frequently.

## Callback Contract

All enrichment workflows POST results to the same endpoint on the web app:

```
POST /api/webhooks/n8n-enrichment
Content-Type: application/json

Body: single object or array of objects
```

Each object must include:
- `enrichmentRunId` (string) - matches the row the app created before triggering
- `workflow` (string) - workflow identifier
- `status` (string) - `"completed"` | `"empty"` | `"failed"` | `"skipped"`
- `output` (object, optional) - workflow-specific result data
- `resultUpdates` (object, optional) - fields to write to the parent Result row

The app's callback handler:
- Accepts results for runs in ANY status (including already-swept `failed` rows)
- Auto-downgrades `completed` to `empty` if no email is present in output/resultUpdates
- Protects existing emails from being overwritten with null
- Logs rescued swept-run updates for auditing

## Adding a New Enrichment Workflow

1. Create the workflow in n8n following the pattern above (Webhook > Respond > Actor > Map > Callback)
2. Note the webhook UUID from the trigger node
3. Add an entry to `ENRICHMENT_WORKFLOWS` in `lib/constants-influencer.ts`:

```typescript
{
  id: "my-new-scraper",
  label: "My Platform",
  platform: "MY_PLATFORM",
  minBatch: 25,
  webhookPath: "<webhook-uuid-from-n8n>",
  costPerResult: 0.05,
  platformIdPrefix: "",
  // inputType: "crawlTargets",  // uncomment for URL-based scrapers
}
```

4. The enrichment runner, manual trigger route, and UI will automatically pick up the new workflow.

## Hosting

- Self-hosted on Railway (Docker-based deployment)
- Persistent execution data stored in Railway's volume
- No external database needed (n8n uses SQLite internally on Railway)
- Apify credentials stored in n8n's credential manager

## Debugging

- **n8n execution log:** Check individual executions in n8n UI for Apify response shape, callback HTTP status
- **App-side diagnostic:** Run `node --env-file=.env check_enrichment.js` in the web app for a full status breakdown
- **Common issues:**
  - 404 on webhook POST: workflow is inactive or webhook UUID doesn't match `constants-influencer.ts`
  - Callbacks returning 401: check `N8N_WEBHOOK_SECRET` alignment between n8n and app
  - Runs stuck at `running`: Apify queue saturated; the 2h sweep will eventually reclaim them, and late callbacks will re-animate

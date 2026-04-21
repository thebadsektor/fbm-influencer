# Infrastructure Setup — Railway + n8n

Walkthrough for the four infra steps that turn the code changes in this PR
into a working autonomous pipeline. Written assuming no prior Railway
experience. Do the steps in order — each one depends on the previous.

**Target project:** `influencer-search` (project ID
`b3fa5f8e-d3ee-4dac-b38d-a9e8f14f13b1`, production environment
`a3067d23-2d59-42b4-ba3f-7250db8028ae`). The app service inside it is
`fbm-influencers` (service ID `c92f95be-c60b-44f1-b558-cab9c6a3f0fd`,
public URL `https://fbm-influencers-production.up.railway.app`).

---

## Table of contents

1. [Provision Redis and wire it into the web service](#1-provision-redis)
2. [Generate and set CRON_SECRET](#2-cron_secret)
3. [Schedule the cron pinger (pick one)](#3-cron-pinger)
4. [Diagnose the YouTube scraper failures in n8n](#4-diagnose-youtube-scraper)
5. [End-to-end verification](#5-end-to-end-verification)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Provision Redis

**Why:** Without Redis, the campaign page's live-log SSE stream is dead and
every `publishDiscoveryEvent` call logs `ENOTFOUND redis.railway.internal`.
The pipeline still runs (the app code now degrades gracefully), but you lose
real-time visibility.

### 1.1 Add a Redis service

1. Open [railway.com](https://railway.com) → open the workspace
   **"AI Agency Projects"** → click the project **`influencer-search`**.
2. Click **`+ Create`** (top right) → **`Database`** → **`Add Redis`**.
3. Railway creates a Redis service named `Redis` with a generated password.
   Leave the defaults. It will finish provisioning in ~30 seconds.

You should now see four services in `influencer-search`:
`fbm-influencers`, `Postgres`, `MinIO-Bucket`, `MinIO-Console`, **`Redis`**.

### 1.2 Reference the Redis URL from the web service

Don't copy the Redis password into the web service manually — use a Railway
**reference variable** so the URL follows the Redis service if it's ever
recreated.

1. Click the **`fbm-influencers`** service.
2. Go to the **`Variables`** tab.
3. Click **`+ New Variable`** → toggle **`Add Reference`** (on some UI
   versions this is a dropdown next to the value field).
4. Set the variable name to `REDIS_URL`.
5. For the value, pick `Redis` → `REDIS_URL` from the reference picker.
   The value should look like `${{Redis.REDIS_URL}}` when referenced.
6. Click **`Add`** and confirm the deploy.

Railway will automatically redeploy `fbm-influencers` with the new variable.
Wait for the deploy to turn green.

### 1.3 Verify Redis is wired up

1. In the `fbm-influencers` service, open **`Deployments`** → click the most
   recent **`SUCCESS`** deploy → **`View logs`**.
2. Search the logs for `redis`:
   - **Before:** lines like `[sse] Redis error for discovery:*:
     getaddrinfo ENOTFOUND redis.railway.internal`.
   - **After:** those errors should be **gone**. No news is good news.
3. Optional: open a campaign page in the app and watch the browser
   DevTools Network tab. The `/api/campaigns/.../stream` SSE request
   should stay connected (instead of emitting `degraded` and closing).

---

## 2. CRON_SECRET

**Why:** `/api/cron/tick` is a powerful endpoint — it advances every
campaign's pipeline. It **must not** be public. The code refuses to run
if `CRON_SECRET` is unset (503), and refuses unknown callers (401).

### 2.1 Generate a secret

On your local machine (any shell):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

That prints a 64-character hex string, e.g.:

```
4f9a2e7d3c1b5e8f6a9d2c4e7f1b3d5a8c0e2f4b6d8a0c2e4f6b8d0a2c4e6f8b
```

Copy it. This is your `CRON_SECRET`.

### 2.2 Store it on the web service

1. Railway → `influencer-search` → `fbm-influencers` → `Variables`.
2. `+ New Variable` — plain variable this time, not a reference.
3. Name: `CRON_SECRET`.
4. Value: the hex string from 2.1.
5. Save → Railway redeploys.

### 2.3 Verify the endpoint

From your local shell, substituting your secret:

```bash
# Should return 401 (no auth)
curl -i https://fbm-influencers-production.up.railway.app/api/cron/tick

# Should return 200 with a JSON summary
curl -i -H "Authorization: Bearer <YOUR_CRON_SECRET>" \
  https://fbm-influencers-production.up.railway.app/api/cron/tick
```

Successful response looks like:

```json
{
  "ok": true,
  "summary": {
    "sweptStaleRuns": 42,
    "stabilizationChecks": 0,
    "autoRunAdvances": 0,
    "retryTriggers": 1,
    "errors": [],
    "durationMs": 734
  }
}
```

A `sweptStaleRuns: 42` on your first call means the orphaned `pending` rows
in the DB got cleaned up — expected.

**Also check Railway logs** (`fbm-influencers` → Deployments → logs). You
should see a line like `[cron-tick] {"sweptStaleRuns":42,...}` — this is
the log line the cron tick prints every time it runs.

---

## 3. Cron pinger

Now you have an endpoint; something needs to hit it every minute. Pick one
of the three options below. **Option A (n8n) is recommended** because your
n8n instance is already running, reliable, and is what our existing
scheduled workflows use.

### Option A — n8n Schedule Trigger (recommended)

**Pros:** already running, already monitored, easy UI. Single point of
failure (if n8n dies, pipeline stops) but n8n dying is already a bigger
problem — enrichment itself runs in n8n.

1. Open your n8n instance:
   `https://primary-production-d7ae.up.railway.app/`. Log in.
2. **Credentials → + Add Credential** (left sidebar).
   - Type: **Header Auth**
   - Name: `FBM Influencers Cron`
   - Header name: `Authorization`
   - Header value: `Bearer <YOUR_CRON_SECRET>` (paste the literal word
     "Bearer" + space + the hex string)
   - Save.
3. **Workflows → + Add Workflow**. Name it `Cron Tick — fbm-influencers`.
4. Add a **Schedule Trigger** node.
   - Rule: **Interval**, Field: **Minutes**, Value: **1**.
5. Connect it to an **HTTP Request** node.
   - Method: `POST`
   - URL: `https://fbm-influencers-production.up.railway.app/api/cron/tick`
   - Authentication: **Generic Credential Type** → **Header Auth** →
     select `FBM Influencers Cron`.
   - Response → Response Format: `JSON` (optional; it's the default).
   - Timeout: `120000` ms (tick can take up to 5 min in heavy ticks, but
     120s is almost always plenty).
   - **Retry on Fail:** enable (3 tries, wait 10s).
6. **Save** the workflow, then toggle **Active** (top right).
7. Click **Execute workflow** once manually to confirm it works. The HTTP
   Request node should show a `200` response with the summary JSON.

**Verify:** over the next 5 minutes, your Railway logs on `fbm-influencers`
should show `[cron-tick]` lines once per minute.

### Option B — Railway Cron Service

**Pros:** fully Railway-native, no dependency on n8n. **Cons:** adds another
service to pay for (minimal — it's a tiny image).

Railway's cron is implemented as a service with a `cronSchedule` config
that runs the start command on the schedule (rather than keeping it
running). We'll deploy a tiny image that just curls the endpoint.

1. Railway → `influencer-search` → `+ Create` → **`Empty Service`**.
   Name it `cron-tick`.
2. In the new service, go to **`Settings`** tab.
   - **Source:** click **Connect Repo** → skip. Use **`Image`** instead
     → enter `curlimages/curl:latest`.
3. Go to **`Variables`** and add:
   - `CRON_SECRET` (reference from `fbm-influencers`: type `${{fbm-influencers.CRON_SECRET}}`).
   - `APP_URL` = `https://fbm-influencers-production.up.railway.app`
     (plain string).
4. Go to **`Settings`** → **`Deploy`** section.
   - **Custom Start Command:**
     ```
     curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/tick"
     ```
   - **Cron Schedule:** `* * * * *` (every minute).
5. Deploy. Each minute Railway will spin up the container, curl the
   endpoint, and exit. Log output from each invocation is visible under
   **Deployments**.

### Option C — External pinger (GitHub Actions, cron-job.org, etc.)

**Pros:** no Railway or n8n coupling. **Cons:** you need to store the
secret on a third party.

**cron-job.org** — free, 1-minute granularity:
1. Create an account at https://cron-job.org.
2. **Cronjobs → Create cronjob**.
3. URL:
   `https://fbm-influencers-production.up.railway.app/api/cron/tick`
4. Schedule: every minute.
5. **Advanced → Request headers:** add
   `Authorization: Bearer <YOUR_CRON_SECRET>`.
6. Save + enable.

**GitHub Actions** — if you already use GitHub, put this at
`.github/workflows/cron-tick.yml`:

```yaml
name: Cron tick
on:
  schedule:
    - cron: "* * * * *" # every minute (GH Actions cron is best-effort)
  workflow_dispatch:
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS \
            -H "Authorization: Bearer $CRON_SECRET" \
            "$APP_URL/api/cron/tick"
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          APP_URL: https://fbm-influencers-production.up.railway.app
```

Note: GitHub Actions cron schedules are delayed under load; if strict
timing matters, prefer Option A or B.

---

## 4. Diagnose YouTube scraper

You have **774 failed YouTube enrichment runs** (99.6% failure rate) and
only 3 successes. No amount of retrying from the app will help if n8n or
Apify is the actual blocker. Work through this section **before** hitting
the "Retry failed leads" button — otherwise you'll just burn money.

### 4.1 Confirm the workflow is active

1. Open n8n: `https://primary-production-d7ae.up.railway.app/`.
2. Workflows → find **`YouTube Email Enrichment v3`** (workflow ID
   `MhNeYUbxWYZPKNT8`).
3. Top right of the workflow page — confirm the toggle says **Active**.
   If it's inactive, all webhook calls return 404 and you'd see that in
   the app's logs as `n8n webhook returned 404`. Turn it on if needed.

### 4.2 Read the recent execution log

1. In the workflow, click the **Executions** tab (top nav).
2. Filter: **Status = Error**. Look at the 20 most recent.
3. Open the most recent one. Find the node that has a red X (usually
   `Scrape Emails`). Click it.
4. Inspect the output pane. Common failure signatures:

| Signature | Meaning | Fix |
|---|---|---|
| `Actor failed to start` / `Actor exited with non-zero code` | Apify actor crashed | Section 4.3 — check Apify |
| `Monthly usage limit exceeded` / `Not enough credits` | Apify account out of credit | Top up at https://console.apify.com/billing |
| `Request failed with status code 4xx` | Apify API auth problem | Rotate the Apify token in n8n credential |
| `Request failed with status code 5xx` | Apify platform outage | Retry later; check https://status.apify.com |
| `timeout` / `request aborted` | Scrape took too long | Section 4.4 — tune timeouts |
| `Error while fetching community nodes: ... 431` | Cosmetic n8n warning, not the cause | Ignore, look for real error below |

Copy the exact error message — you'll need it if none of the above fits.

### 4.3 Check Apify directly

1. Open https://console.apify.com/ → log in with the account whose API
   token is in n8n.
2. **Billing** (left sidebar) → confirm you have credit left. Monthly
   usage > 100% means every scrape will fail. Top up if needed.
3. **Actors** → search
   `dataovercoffee/Youtube-Channel-Business-Email-Scraper`.
4. Open it → **Runs** tab. Filter by status `FAILED`. Look at the 5 most
   recent.
5. Open a failed run. Read the **Log** tab for the real error. Typical
   causes:
   - YouTube changed its HTML layout → actor version drift. Check the
     actor's **README** and **Issues** tab. If the actor hasn't been
     updated in months, it may be broken for everyone; switch to an
     alternative actor.
   - Proxy/cookie issues — rare; restart.
   - Rate-limit — space out your chunks (we already cap at 50 per POST).

### 4.4 Tune if needed

If Apify looks healthy but scrapes are timing out:

1. In n8n → the workflow → the `Scrape Emails` node.
2. **Settings** → increase **Timeout** (default is often 5 min; raise to
   10–15 min).
3. **Parameters** → confirm `memoryMbytes` is at least 512; bump to 1024
   if the actor's docs recommend it.

### 4.5 Fix verification

Once you've identified and fixed the root cause:

1. Open the app → a campaign with failed runs (e.g. `MAGA Campaign 4`).
2. Open the **Email Enrichment** sheet.
3. Click **Retry N failed leads** (this button appears only when
   `wf.failed > 0`).
4. Within ~1 minute, you should see the `failed` count drop and `active`
   count rise. A few minutes later, n8n callbacks arrive and `completed`
   starts climbing.

If retries fail again immediately, the root cause is not fixed — go back
to 4.2 and read the fresh error.

### 4.6 Alternative actors (nuclear option)

If `dataovercoffee/Youtube-Channel-Business-Email-Scraper` is broken for
good, these are the alternatives we've seen in the wild:

- `streamers/youtube-scraper` — general-purpose, higher cost, needs an
  "about page" filter.
- `epctex/youtube-email-scraper` — similar semantics, usually cheaper.
- Roll your own using `apify/puppeteer-scraper` against the channel About
  page.

To switch, edit `lib/constants-influencer.ts` → `ENRICHMENT_WORKFLOWS` →
change the `webhookPath` to a new n8n workflow that uses the new actor.
Keep the ID `youtube-email-scraper` (that's the workflow name our app
keys off; the webhookPath is just where the POST goes).

---

## 5. End-to-end verification

After **all four sections** are done:

### 5.1 Database state

```bash
node --env-file=.env check_enrichment.js
```

Expected changes from the pre-PR baseline:
- `pending` count drops to **0** (sweep now includes pending; cron tick
  runs the sweep every minute).
- `failed` count starts dropping as retries go through (once n8n side is
  fixed).
- `completed` + `empty` start climbing.

### 5.2 Cron tick is running

`fbm-influencers` deploy logs should show:

```
[cron-tick] {"sweptStaleRuns":0,"stabilizationChecks":2,"autoRunAdvances":1,"retryTriggers":0,"errors":[],"durationMs":642}
```

…every 60 seconds. If you see zero `[cron-tick]` lines in 10 minutes,
your pinger is broken — revisit section 3.

### 5.3 Redis SSE works

Open a campaign page in the app. Open DevTools → Network → XHR/fetch.
Find the `stream/route` request. It should stay open (status column:
`(pending)`) and receive event chunks as `data: {...}` every few seconds
during active discovery. If it closes immediately with a `degraded`
event, Redis isn't wired up — revisit section 1.

### 5.4 Autonomy smoke test

This is the one the whole PR is about.

1. Start a fresh campaign in the app. Make sure `autoRun` is **on**.
2. Trigger discovery (submit the first KH set).
3. **Close the browser tab completely.**
4. Wait 15 minutes — go grab coffee.
5. Come back and open the campaign page. It should have advanced at
   least one round: discovery → profiling → enrichment (if minBatch
   met) → awaiting_approval → next round (because autoRun).

If the campaign is frozen at the same stage where you closed the tab,
the cron tick isn't being called. Check section 3.

### 5.5 Webhook cascade

Stand up a campaign with a lot of qualified leads so enrichment actually
runs. While enrichment is in flight, watch `fbm-influencers` logs. You
should see:

```
[enrichment-callback] ...
```

and shortly after, a **new** `runEnrichmentStep` log line — that's the
cascade firing. Before this PR, the webhook just updated rows and
returned; now it kicks progress forward.

---

## 6. Troubleshooting

**`/api/cron/tick` returns 503 "CRON_SECRET is not configured"**
- The env var isn't set on the `fbm-influencers` service. Section 2.2.

**`/api/cron/tick` returns 401 "Unauthorized"**
- Your pinger is sending the wrong secret. Re-check section 2.2 vs.
  section 3's pinger config. Spaces, quotes, or "Bearer " prefix are
  common typos.

**Redis logs still show `ENOTFOUND`**
- `REDIS_URL` on `fbm-influencers` is probably a plain string, not a
  reference. Section 1.2 step 3: look for `${{Redis.REDIS_URL}}` in the
  Variables tab. If you see the literal URL starting with `redis://`,
  delete it and recreate as a reference.

**Cron tick runs but `pending` count doesn't drop**
- The 42 pending rows are probably younger than 2 hours — stale-sweep
  has a 2h threshold. Either wait, or lower `STALE_RUN_THRESHOLD_MS` in
  `lib/enrichment-runner.ts` temporarily, deploy, let it sweep, then
  raise it back.

**Cron tick fires but campaigns don't advance**
- Check `summary.errors` in the tick response. Common:
  - `autoRun {id}: Campaign is in "enriching" status — cannot continue` —
    this is correct behavior; only `awaiting_approval` campaigns advance.
  - `stabilize {id}: ...` — look at the specific error; usually an
    OpenAI / DB issue.

**n8n cron workflow shows green but nothing hits the app**
- HTTP Request node timeout is too low. Some ticks take 30–60s. Set
  timeout to 120000ms in the node settings.

**Retry button does nothing**
- Response says `No failed leads currently eligible for retry` — this
  means all "failed" leads also have a pending/running/completed/empty
  run for the same workflow (the new fresh rows from the retry are in
  flight). Wait a few minutes; they'll either complete or fail, and then
  the button can fire again.

**Build fails locally but prod is fine**
- The `preDeployCommand: npx prisma migrate deploy` is configured on the
  Railway service. If you added a new migration locally, make sure it's
  committed and pushed — Railway applies migrations on deploy, not on
  runtime.

---

## References

- `lib/cron-tick.ts` — the orchestrator this runbook is about
- `app/api/cron/tick/route.ts` — the HTTP entrypoint
- `app/api/campaigns/[id]/enrichment/retry-failed/route.ts` — the manual
  retry endpoint the "Retry failed" button calls
- `lib/enrichment-runner.ts` — `sweepStaleEnrichmentRuns`, eligibility
  logic
- `lib/redis.ts` — null-safe publish
- `docs/README-n8n.md` — existing n8n workflow docs (for extending or
  changing workflows)

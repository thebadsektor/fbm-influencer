# Influencer Funnel Builder

AI-powered influencer discovery, profiling, and outreach platform. Automatically finds creators across YouTube and TikTok, scores them for campaign fit, enriches contact emails via Apify, and generates personalized outreach drafts with a built-in WYSIWYG email composer.

## About the Project

Built for brands and agencies running influencer marketing campaigns at scale. The platform replaces the manual process of searching for creators, vetting them, finding contact info, and writing personalized emails with a self-learning AI pipeline that improves its keyword strategy each round.

**Core loop:**

1. **Discovery** - n8n workflows scrape YouTube/TikTok using AI-generated keyword + hashtag sets
2. **AI Profiling** - LLM scores each creator for campaign fit (brand alignment, audience overlap, content themes)
3. **Email Enrichment** - Apify actors scrape public business emails from YouTube About pages and TikTok Linktree bios
4. **Outreach** - LLM generates personalized HTML email drafts; Gmail-clone composer for review and sending via SendGrid
5. **Self-Learning** - AI analyzes which keywords/hashtags produced high-fit creators and generates an improved strategy for the next round

The pipeline runs autonomously (auto-run mode) or step-by-step with human approval gates.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| Database | PostgreSQL (Railway) + Prisma 7 ORM |
| Auth | Better Auth 1.5 (Google OAuth, email/password, admin roles) |
| AI/LLM | OpenAI gpt-4o-mini, Anthropic Claude Sonnet, Google Gemini Flash |
| Email Sending | SendGrid |
| Orchestration | n8n (self-hosted on Railway) - see [n8n README](docs/README-n8n.md) |
| Scraping | Apify (YouTube email scraper, TikTok Linktree scraper) |
| Real-time | Redis pub/sub (ioredis) + Server-Sent Events |
| Payments | Stripe (Plus / Enterprise tiers) |
| Object Storage | MinIO (S3-compatible) |
| UI | Tailwind CSS 4, Shadcn/Radix, Framer Motion |

## Architecture

```
Browser (Next.js App)
  |
  |-- SSE stream <-- Redis pub/sub <-- n8n events
  |
  |-- API Routes
  |     |-- /api/campaigns/[id]/kh-sets/       Discovery management
  |     |-- /api/campaigns/[id]/profile         AI profiling trigger
  |     |-- /api/campaigns/[id]/enrichment/     Email enrichment
  |     |-- /api/campaigns/[id]/outreach/       Draft generation + sending
  |     |-- /api/webhooks/n8n-*                 Callbacks from n8n
  |
  |-- Prisma --> PostgreSQL (Railway)
  |
  n8n (Railway)
    |-- Discovery workflow          Apify YouTube/TikTok scrapers
    |-- YouTube Email Enrichment    Apify dataovercoffee actor
    |-- TikTok Linktree Enrichment  Apify ahmed_jasarevic actor
    |
    Apify Cloud (pay-per-use scraping)
```

## Data Models

| Model | Purpose |
|-------|---------|
| **Campaign** | Marketing goal, brand niche, target audience, enrichment budget, auto-run config |
| **KHSet** | Keyword/hashtag set submitted to n8n for discovery scraping |
| **Result** | Individual creator profile (name, handle, email, fit score, followers, content themes) |
| **EnrichmentRun** | Tracks each Apify scrape attempt per creator (running / completed / empty / failed) |
| **EmailDraft** | Generated outreach email with subject, HTML body, version history, send status |
| **CampaignIteration** | Learning loop metadata: keyword performance, fit distribution, strategy narrative |
| **Document** | Campaign brief uploads with AI analysis cache |
| **Credential** | Encrypted API keys for external services (LLM, Apify, n8n, CRM) |

## Getting Started

### Prerequisites

- Node.js 20+ with pnpm
- PostgreSQL (local or Railway)
- Redis (local or Railway)
- n8n instance (see [docs/README-n8n.md](docs/README-n8n.md))
- Apify account with credit
- SendGrid API key (for email sending)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
BETTER_AUTH_SECRET=...

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Email
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=outreach@yourdomain.com

# n8n
N8N_BASE_URL=https://your-n8n.railway.app

# Redis
REDIS_URL=redis://...

# App
APP_URL=https://your-app.railway.app
ENCRYPTION_KEY=<64-char-hex>

# Payments (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Object Storage (optional)
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
```

### Installation

```bash
pnpm install
npx prisma generate
npx prisma db push        # or: npx prisma migrate deploy
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Useful Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `npx prisma studio` | Visual database browser |
| `npx prisma migrate dev` | Run database migrations |
| `node --env-file=.env check_enrichment.js` | Diagnostic: enrichment status breakdown |

## Pipeline Details

### Discovery Loop

Self-learning loop in `lib/discovery-loop.ts`:

1. **Generate KH Set** - LLM creates optimized keywords + hashtags based on campaign goals and learnings from prior rounds
2. **Submit to n8n** - Webhook triggers the discovery workflow (Apify scrapes YouTube/TikTok)
3. **AI Profiling** - Batch LLM scoring of each creator for campaign fit (0-100 score, content themes, fit reasoning)
4. **Iteration Analysis** - LLM reviews what worked and what didn't, generates improved strategy for next round
5. **Enrichment** - When qualified leads with missing emails exceed batch threshold, triggers Apify email scrapers
6. **Loop or Pause** - Auto-run continues to next round; manual mode pauses at `awaiting_approval`

### Email Enrichment

Managed by `lib/enrichment-runner.ts`:

- Batches of 50 leads per n8n webhook POST (prevents Apify queue saturation)
- Stale run sweep: 2-hour threshold for unresponsive callbacks
- Late callback rescue: if a run was swept to `failed` but the callback arrives later, the data is still saved (never discard paid-for data)
- Status taxonomy: `running` -> `completed` (email found) | `empty` (no public email) | `failed` (error/timeout)
- Enrichment workflows are configured in `lib/constants-influencer.ts` (webhook paths, cost per result, platform filters)

### Outreach

Managed by `lib/outreach-generator.ts`:

- Personalized HTML email drafts via LLM (gpt-4o-mini default)
- Concurrency-limited batch generation (10 parallel)
- Server-side HTML guarantee: post-processes plain text if LLM ignores format rules
- Version history: each regeneration saves the previous draft
- Gmail-clone WYSIWYG editor with bold/italic/lists/links, light/dark theme toggle, debounced auto-save
- Outreach dashboard with funnel stats, sends-over-time chart, status breakdown, needs-attention table

## Features

- **Campaign Timeline** - Step-by-step progress: Discovery > AI Profiling > Email Enrichment > Outreach
- **Team Visibility** - Admin users see all campaigns across the organization
- **Real-time Updates** - SSE stream shows live progress during discovery, profiling, and enrichment
- **Outreach Dashboard** - Funnel metrics, send velocity, failure tracking, cost estimates
- **WYSIWYG Email Composer** - Rich text editing with formatting toolbar, theme preview, auto-save
- **Subscription Management** - Tiered plans (Plus, Enterprise) via Stripe
- **Admin Dashboard** - User management, subscription monitoring, notifications
- **Community** - Discussion boards, feedback system, voting, moderation
- **Credential Vault** - Encrypted storage for API keys (LLM, Apify, n8n, CRM)

## Project Structure

```
app/                     Next.js App Router pages and API routes
  api/
    campaigns/[id]/      Campaign CRUD, discovery, profiling, enrichment, outreach
    webhooks/            n8n callback handlers (enrichment, stats, affinity)
    credentials/         Encrypted API key management
    admin/               User management, analytics
components/
  campaign/              Campaign-specific UI (timeline, enrichment, outreach)
  ui/                    Shadcn base components
lib/
  discovery-loop.ts      Core self-learning pipeline
  enrichment-runner.ts   Apify enrichment orchestration
  outreach-generator.ts  LLM email draft generation
  llm.ts                 Multi-provider LLM abstraction
  redis.ts               Pub/sub event broadcasting
  prisma.ts              Database client singleton
  constants-influencer.ts  Workflow configs, enrichment settings
prisma/
  schema.prisma          Database schema
docs/
  README-n8n.md          n8n workflow documentation
  README-twenty.md       Twenty CRM integration documentation
```

## Deployment

Hosted on **Railway** with:
- Next.js web service (auto-deploy on push to main)
- PostgreSQL database
- Redis instance (optional — powers SSE live log; app degrades gracefully if missing)
- n8n workflow engine (separate service)

### Server-side pipeline ticking (required)

The pipeline advances via `POST /api/cron/tick`. Without a ticker, campaigns
only advance when a user has the campaign page open in a browser — that's
exactly the stall mode the `/cron/tick` endpoint exists to fix.

**Setup:**

1. Generate a `CRON_SECRET` and set it on the web service:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Configure a 60-second pinger. Options (pick one):
   - **Railway cron service** — add a separate cron service in the project that
     runs `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/tick`
   - **n8n scheduled workflow** — Schedule Trigger (every minute) → HTTP Request
     (POST `$APP_URL/api/cron/tick`, header `Authorization: Bearer $CRON_SECRET`)
   - **External pinger** (cron-job.org, GitHub Actions schedule) — same URL,
     same header

The tick does: stale-run sweep, discovery stabilization check, autoRun round
advancement, and retry of campaigns with failed enrichment backlog.

**Full step-by-step Railway + n8n setup guide:**
[`docs/README-infra-setup.md`](docs/README-infra-setup.md) — written for
someone who hasn't touched Railway infra before. Covers Redis provisioning,
`CRON_SECRET`, pinger options, YouTube scraper diagnosis, and troubleshooting.

## License

This project is proprietary.

---

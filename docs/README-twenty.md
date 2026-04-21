# Twenty CRM Integration

[Twenty](https://twenty.com) is an open-source CRM used alongside the Influencer Funnel Builder to manage creator relationships beyond the initial outreach phase.

## About

While the main app handles discovery, profiling, enrichment, and outreach generation, Twenty CRM serves as the long-term relationship management layer. Once a creator responds to outreach, their record can be synced to Twenty for deal tracking, communication history, and pipeline management.

## Current Status

The integration is **planned but not yet active**. The credential infrastructure is in place:

- **Credential storage:** Users can store their Twenty CRM API key via the encrypted credential vault at `/credentials` (service type: `twenty`)
- **No active sync:** There are no API calls to Twenty in the codebase yet. The integration point exists as a placeholder in the credential system.

## Planned Integration

### Phase 1: One-way sync (app -> Twenty)

When an outreach email gets a reply or a draft is marked as `sent`, sync the creator as a Twenty contact/company:

| Influencer App Field | Twenty CRM Field |
|---------------------|-----------------|
| `Result.creatorName` | Contact: Full Name |
| `Result.email` | Contact: Email |
| `Result.platform` | Contact: Custom field (Platform) |
| `Result.creatorHandle` | Contact: Custom field (Handle) |
| `Result.profileUrl` | Contact: Links |
| `Result.campaignFitScore` | Contact: Custom field (Fit Score) |
| `Result.followers` | Contact: Custom field (Followers) |
| `EmailDraft.subject` | Activity: Email subject |
| `EmailDraft.sentAt` | Activity: Email sent date |
| `Campaign.name` | Deal: Name |

### Phase 2: Two-way sync

- Pull reply/deal status from Twenty back into the app's outreach dashboard
- Update `EmailDraft.status` based on Twenty deal stage changes
- Bi-directional note sync

## Twenty Setup

### Self-hosted

Twenty can be self-hosted alongside the app on Railway:

1. Deploy Twenty via their [Docker setup](https://twenty.com/developers/section/self-hosting)
2. Create an API key in Twenty (Settings > API Keys)
3. Store the API key in the app at `/credentials` with service type "Twenty CRM"

### Cloud

Use Twenty's hosted version at [app.twenty.com](https://app.twenty.com):

1. Sign up and create a workspace
2. Generate an API key (Settings > API Keys)
3. Store it in the app's credential vault

## API Reference

Twenty uses a REST + GraphQL API. Key endpoints for the integration:

```
Base URL: https://api.twenty.com/rest or your self-hosted URL

# Create a person (contact)
POST /rest/people
{
  "name": { "firstName": "...", "lastName": "..." },
  "emails": { "primaryEmail": "creator@example.com" }
}

# Create a company
POST /rest/companies
{
  "name": "Creator Channel Name"
}

# Create an activity (email log)
POST /rest/activities
{
  "title": "Outreach: Subject Line",
  "type": "Email"
}
```

Full API docs: [twenty.com/developers](https://twenty.com/developers)

## Architecture Note

The credential vault (`/api/credentials`) encrypts API keys at rest using AES-256 with the `ENCRYPTION_KEY` environment variable. When the Twenty sync is implemented, the app will decrypt the stored key on each API call rather than storing it in env vars — allowing per-user or per-team CRM connections.

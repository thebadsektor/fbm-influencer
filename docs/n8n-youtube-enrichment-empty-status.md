# n8n: emit `status: 'empty'` natively for no-email results

Applies to BOTH enrichment workflows:

| Workflow | ID | Node to edit |
|---|---|---|
| YouTube Email Enrichment v3 | `MhNeYUbxWYZPKNT8` | Map Results to App (`map-enrich`) |
| TikTok Linktree Enrichment v2 | `uNUFyokMbNW7zvvC` | Map Results to App (`map-tiktok`) |

Both workflows' Code nodes have the same shape: set `status: 'completed'` when an email is found, `status: 'empty'` when scraper ran but found none.

## Why

The Next.js callback at `app/api/webhooks/n8n-enrichment/route.ts` now auto-downgrades any `completed`-with-no-email callback to `status: 'empty'` before writing to Postgres. So **the app already does the right thing** regardless of what n8n reports. Updating n8n just keeps the two sides consistent — the n8n execution log will match the DB.

## The two lines to change

Inside the `jsCode` of the "Map Results to App" node, find the two places that currently hardcode `status: 'completed'` with `email: null` and change them to `status: 'empty'`.

### Diff

```diff
       if (d.Status !== 'EMAIL_AVAILABLE' || !d.Email) {
         skippedNoEmail++;
-        // Still mark as completed (no email found)
+        // Mark as empty (scraper ran, channel has no public email)
         const mapping = enrichmentRunMap[d.ChannelId];
         if (mapping) {
           results.push({
             json: {
               enrichmentRunId: mapping.enrichmentRunId,
               workflow: workflow,
-              status: 'completed',
+              status: 'empty',
               output: { email: null, channelId: d.ChannelId },
               resultUpdates: {}
             }
           });
         }
         continue;
       }
```

```diff
-// If Apify returned NOTHING, mark ALL runs as completed (no email)
+// If Apify returned NOTHING, mark ALL runs as empty (no email)
 if (apifyItems.length === 0 || results.length === 0) {
   for (const [channelId, mapping] of Object.entries(enrichmentRunMap)) {
     const alreadyHandled = results.find(r => r.json.enrichmentRunId === mapping.enrichmentRunId);
     if (!alreadyHandled) {
       results.push({
         json: {
           enrichmentRunId: mapping.enrichmentRunId,
           workflow: workflow,
-          status: 'completed',
+          status: 'empty',
           output: { email: null, channelId, reason: 'Apify returned no results' },
           resultUpdates: {}
         }
       });
     }
   }
 }
```

The match where `d.Status === 'EMAIL_AVAILABLE'` and `d.Email` is set stays as `status: 'completed'` — that's correct.

## TikTok Linktree Enrichment v2 — same change

The TikTok Code node has the same shape. Update the TWO places that push `status: 'completed'` with `email: null`:

```diff
   results.push({
     json: {
       enrichmentRunId: mapping.enrichmentRunId,
       workflow: workflow,
-      status: 'completed',
+      status: email ? 'completed' : 'empty',
       output: {
         email: email,
         url: url,
         ...
       },
       ...
     }
   });
```

And the fallback loop:

```diff
 for (const [url, mapping] of Object.entries(enrichmentRunMap)) {
   const found = results.find(r => r.json.enrichmentRunId === mapping.enrichmentRunId);
   if (!found) {
     results.push({
       json: {
         enrichmentRunId: mapping.enrichmentRunId,
         workflow: workflow,
-        status: 'completed',
+        status: 'empty',
         output: { email: null, url, reason: 'No email found on page' },
         resultUpdates: {}
       }
     });
   }
 }
```

## How to apply

1. Open n8n → "YouTube Email Enrichment v3" → "Map Results to App" Code node
2. Apply the YouTube diff above, save & activate
3. Open "TikTok Linktree Enrichment v2" → "Map Results to App" Code node
4. Apply the TikTok diff above, save & activate

Server-side safety net: `app/api/webhooks/n8n-enrichment/route.ts` already auto-downgrades `completed` → `empty` when the payload has no email, so skipping this change doesn't break anything. It only makes the n8n execution log honest.

## Alternative: let Claude do it

If you set `N8N_API_KEY` in the project env pointing at a valid n8n personal API token, I can PATCH the workflow via `PUT /api/v1/workflows/:id`. Today the env only has `N8N_BASE_URL` and webhook paths — no editor-scope key.

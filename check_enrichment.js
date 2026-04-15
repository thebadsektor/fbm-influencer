// Diagnostic: why is enrichment "stuck at 5.4%"? Read-only.
const { Client } = require('/Users/geraldvillaran/Projects/fbm-influencer/node_modules/.pnpm/pg@8.18.0/node_modules/pg');

async function q(c, label, sql) {
  console.log(`\n=== ${label} ===`);
  try {
    const res = await c.query(sql);
    console.log(JSON.stringify(res.rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await q(client, '1. EnrichmentRun status breakdown', `
    SELECT status, COUNT(*)::int AS n FROM enrichment_run GROUP BY status ORDER BY n DESC;
  `);

  await q(client, '2. Age buckets for status=running', `
    SELECT
      COUNT(*) FILTER (WHERE "startedAt" > NOW() - INTERVAL '30 minutes')::int AS fresh,
      COUNT(*) FILTER (WHERE "startedAt" <= NOW() - INTERVAL '30 minutes' AND "startedAt" > NOW() - INTERVAL '1 hour')::int AS bucket_30m_1h,
      COUNT(*) FILTER (WHERE "startedAt" <= NOW() - INTERVAL '1 hour' AND "startedAt" > NOW() - INTERVAL '1 day')::int AS bucket_1h_1d,
      COUNT(*) FILTER (WHERE "startedAt" <= NOW() - INTERVAL '1 day' AND "startedAt" > NOW() - INTERVAL '7 days')::int AS bucket_1d_7d,
      COUNT(*) FILTER (WHERE "startedAt" <= NOW() - INTERVAL '7 days')::int AS over_1_week
    FROM enrichment_run WHERE status = 'running';
  `);

  await q(client, '3. Workflow x status (running + failed)', `
    SELECT workflow, status, COUNT(*)::int AS n FROM enrichment_run
    WHERE status IN ('running','failed') GROUP BY workflow, status ORDER BY workflow, status;
  `);

  await q(client, '4. Completed but cost=0/null', `
    SELECT workflow, COUNT(*)::int AS n FROM enrichment_run
    WHERE status='completed' AND (cost IS NULL OR cost = 0) GROUP BY workflow;
  `);

  await q(client, '5. Per-campaign rollup (by pct_with_email ASC)', `
    SELECT c.id, c.name, c.status AS campaign_status,
      COUNT(DISTINCT r.id)::int AS total_results,
      COUNT(DISTINCT r.id) FILTER (WHERE r.email IS NOT NULL AND r.email <> '')::int AS with_email,
      COUNT(DISTINCT er.id)::int AS total_runs,
      COUNT(DISTINCT er.id) FILTER (WHERE er.status='running')::int AS running_runs,
      COUNT(DISTINCT er.id) FILTER (WHERE er.status='completed')::int AS completed_runs,
      COUNT(DISTINCT er.id) FILTER (WHERE er.status='failed')::int AS failed_runs,
      ROUND(100.0 * COUNT(DISTINCT r.id) FILTER (WHERE r.email IS NOT NULL AND r.email <> '') / NULLIF(COUNT(DISTINCT r.id),0), 1) AS pct_with_email
    FROM campaign c
    LEFT JOIN kh_set k ON k."campaignId" = c.id
    LEFT JOIN result r ON r."khSetId" = k.id
    LEFT JOIN enrichment_run er ON er."resultId" = r.id
    GROUP BY c.id, c.name, c.status
    HAVING COUNT(DISTINCT r.id) > 0
    ORDER BY pct_with_email ASC NULLS LAST
    LIMIT 20;
  `);

  await q(client, '6. Orphan analysis', `
    SELECT
      COUNT(*) FILTER (WHERE r.email IS NOT NULL AND r.email <> '' AND NOT EXISTS (
        SELECT 1 FROM enrichment_run er WHERE er."resultId" = r.id))::int AS email_but_no_run,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM enrichment_run er WHERE er."resultId" = r.id AND er.status='completed'
      ) AND (r.email IS NULL OR r.email = ''))::int AS completed_run_but_no_email
    FROM result r;
  `);

  await q(client, '7. KHSet.enriched drift', `
    SELECT k.id, k.name, k.enriched AS cached,
      COUNT(DISTINCT r.id) FILTER (WHERE r.email IS NOT NULL AND r.email <> '')::int AS actual_with_email,
      COUNT(DISTINCT r.id)::int AS total_results
    FROM kh_set k
    LEFT JOIN result r ON r."khSetId" = k.id
    GROUP BY k.id, k.name, k.enriched
    HAVING k.enriched <> COUNT(DISTINCT r.id) FILTER (WHERE r.email IS NOT NULL AND r.email <> '')
    ORDER BY ABS(k.enriched - COUNT(DISTINCT r.id) FILTER (WHERE r.email IS NOT NULL AND r.email <> '')) DESC
    LIMIT 10;
  `);

  await q(client, '8. Recent CampaignIterations', `
    SELECT id, "campaignId", status, "createdAt", "profilingDuration", "discoveryDuration"
    FROM campaign_iteration ORDER BY "createdAt" DESC LIMIT 10;
  `);

  await q(client, '9. Campaigns by status', `
    SELECT status, COUNT(*)::int AS n FROM campaign GROUP BY status ORDER BY n DESC;
  `);

  await q(client, '10. Eligible-but-never-enriched per campaign', `
    SELECT c.id, c.name,
      COUNT(r.id)::int AS qualified_no_email,
      COUNT(r.id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM enrichment_run er WHERE er."resultId" = r.id))::int AS never_enriched
    FROM campaign c
    JOIN kh_set k ON k."campaignId" = c.id
    JOIN result r ON r."khSetId" = k.id
    WHERE (r.email IS NULL OR r.email = '')
      AND r."profileUrl" IS NOT NULL
    GROUP BY c.id, c.name
    HAVING COUNT(r.id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM enrichment_run er WHERE er."resultId" = r.id)) > 0
    ORDER BY never_enriched DESC
    LIMIT 10;
  `);

  await q(client, '11. Oldest 5 running runs', `
    SELECT id, "resultId", workflow, "startedAt", (NOW() - "startedAt")::text AS age
    FROM enrichment_run WHERE status='running' ORDER BY "startedAt" ASC LIMIT 5;
  `);

  await client.end();
})();

// Quantify how many emails are already in our DB hidden in bio/rawText/crawlTargets.
// Read-only.
const { Client } = require('/Users/geraldvillaran/Projects/fbm-influencer/node_modules/.pnpm/pg@8.18.0/node_modules/pg');
const RE = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';

async function q(c, label, sql, params) {
  console.log(`\n=== ${label} ===`);
  try {
    const r = await c.query(sql, params || []);
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) { console.log('ERROR:', e.message); }
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  await q(c, 'A. Hits in bio/rawText/crawlTargets where email IS NULL', `
    SELECT
      COUNT(*) FILTER (WHERE bio ~ $1)::int AS bio_hits,
      COUNT(*) FILTER (WHERE "rawText" ~ $1)::int AS rawtext_hits,
      COUNT(*) FILTER (WHERE "crawlTargets" ~ $1)::int AS crawltargets_hits,
      COUNT(*) FILTER (WHERE bio ~ $1 OR "rawText" ~ $1 OR "crawlTargets" ~ $1)::int AS any_hits,
      COUNT(*)::int AS total_no_email
    FROM result WHERE (email IS NULL OR email = '')`, [RE]);

  await q(c, 'B. Per-platform extractable candidates', `
    SELECT platform,
      COUNT(*) FILTER (WHERE bio ~ $1 OR "rawText" ~ $1 OR "crawlTargets" ~ $1)::int AS extractable,
      COUNT(*)::int AS total_no_email
    FROM result WHERE (email IS NULL OR email = '')
    GROUP BY platform`, [RE]);

  await q(c, 'C. 5 sample bios with email-shaped strings', `
    SELECT "creatorName", platform, LEFT(bio, 250) AS bio_sample
    FROM result WHERE (email IS NULL OR email = '') AND bio ~ $1 LIMIT 5`, [RE]);

  await q(c, 'D. 5 crawlTargets with email-shaped strings', `
    SELECT "creatorName", platform, "crawlTargets"
    FROM result WHERE (email IS NULL OR email = '') AND "crawlTargets" ~ $1 LIMIT 5`, [RE]);

  await q(c, 'E. Results with crawlTargets URLs (potential domain-based enrichment)', `
    SELECT COUNT(*)::int AS with_crawl_url, COUNT(DISTINCT platform)::int AS platforms
    FROM result WHERE (email IS NULL OR email = '')
      AND "crawlTargets" IS NOT NULL AND "crawlTargets" <> ''`);

  await q(c, 'F. Sample bio length distribution', `
    SELECT
      COUNT(*) FILTER (WHERE bio IS NOT NULL AND bio <> '')::int AS with_bio,
      AVG(LENGTH(bio))::int AS avg_len,
      MAX(LENGTH(bio))::int AS max_len
    FROM result WHERE (email IS NULL OR email = '')`);

  await c.end();
})();

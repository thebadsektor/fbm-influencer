// Tier 1 enrichment handler — runs in-process, no external calls.
// Mines bio + rawText for email patterns. Free. Blocks the request handler,
// so kept fast and synchronous.

import type { EnrichmentHandlerInput, EnrichmentHandlerResult } from "./types";

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,24}/g;

const NOISE_PATTERNS = [
  /^noreply@/i, /^no-reply@/i, /^donotreply@/i, /^do-not-reply@/i,
  /^postmaster@/i, /^mailer-daemon@/i, /^example@/i,
  /@example\./i, /@test\./i, /^abuse@/i, /^webmaster@/i,
];

export async function run(input: EnrichmentHandlerInput): Promise<EnrichmentHandlerResult> {
  const haystacks = [input.result.bio, input.result.rawText].filter(
    (s): s is string => typeof s === "string" && s.length > 0
  );
  if (haystacks.length === 0) {
    return { status: "empty", reason: "no bio or rawText" };
  }

  const candidates = new Set<string>();
  for (const text of haystacks) {
    const matches = text.match(EMAIL_RE);
    if (matches) for (const m of matches) candidates.add(m.trim().toLowerCase());
  }

  const accepted = [...candidates].filter(
    (e) => !NOISE_PATTERNS.some((p) => p.test(e))
  );

  if (accepted.length === 0) {
    return { status: "empty", reason: "no email pattern in bio/rawText" };
  }

  // Prefer non-role addresses if multiple
  const ROLE_PREFIXES = [
    "info@", "contact@", "hello@", "support@", "admin@",
    "press@", "media@", "business@", "biz@", "team@",
  ];
  const isRole = (e: string) => ROLE_PREFIXES.some((p) => e.startsWith(p));
  accepted.sort((a, b) => Number(isRole(a)) - Number(isRole(b)));

  return {
    status: "completed",
    email: accepted[0],
    emailSource: "bio-regex",
    output: { allCandidates: accepted, source: "bio-or-rawText" },
  };
}

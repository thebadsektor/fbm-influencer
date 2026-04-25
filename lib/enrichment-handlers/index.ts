// Registry of in-process enrichment handlers. Maps `workflow.handler` (a string
// id from constants-influencer.ts) to the actual implementation function.

import type { EnrichmentHandler } from "./types";
import { run as bioEmailExtractor } from "./bio-email-extractor";

export const HANDLERS: Record<string, EnrichmentHandler> = {
  "bio-email-extractor": bioEmailExtractor,
};

export function getHandler(name: string): EnrichmentHandler | null {
  return HANDLERS[name] ?? null;
}

export type { EnrichmentHandlerInput, EnrichmentHandlerResult, EligibleResult } from "./types";

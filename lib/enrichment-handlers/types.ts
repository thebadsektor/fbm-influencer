// Shared types for in-process enrichment handlers (runner: "server").
// Each handler is a pure async function with this contract.

export type EligibleResult = {
  id: string;
  platformId: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  bio: string | null;
  rawText: string | null;
  crawlTargets: string | null;
  profileUrl: string | null;
};

export type EnrichmentHandlerInput = {
  result: EligibleResult;
  workflowId: string;
};

export type EnrichmentHandlerResult =
  | {
      status: "completed";
      email: string;
      emailSource: string;
      /** Optional: arbitrary JSON written to EnrichmentRun.output */
      output?: Record<string, unknown>;
    }
  | {
      status: "empty";
      reason?: string;
      output?: Record<string, unknown>;
    }
  | {
      status: "failed";
      error: string;
      output?: Record<string, unknown>;
    };

export type EnrichmentHandler = (input: EnrichmentHandlerInput) => Promise<EnrichmentHandlerResult>;

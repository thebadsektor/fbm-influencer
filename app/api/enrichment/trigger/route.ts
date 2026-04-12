import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Trigger enrichment for leads that haven't been through a specific workflow.
 *
 * The app calls this to kick off enrichment. It:
 * 1. Finds Results that haven't completed the specified workflow
 * 2. Creates EnrichmentRun records with status "pending"
 * 3. Returns the run IDs + creator data for the caller to POST to n8n
 *
 * POST body:
 * {
 *   workflow: string,                 // e.g. "youtube-email-scraper"
 *   khSetId?: string,                 // optional: scope to a specific KH set
 *   platform?: string,                // optional: filter by platform
 *   limit?: number,                   // max leads to process (default 50)
 *   filters?: {                       // optional: additional filters
 *     hasEmail?: boolean,             // true = only leads with email, false = without
 *     hasCrawlTargets?: boolean,
 *     hasAffinityProfile?: boolean,
 *   }
 * }
 *
 * Returns:
 * {
 *   runs: [{ enrichmentRunId, resultId, creatorData }],
 *   total: number
 * }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const workflow = body.workflow as string;

  if (!workflow) {
    return NextResponse.json(
      { error: "workflow is required" },
      { status: 400 }
    );
  }

  const limit = Math.min(Number(body.limit) || 50, 200);
  const khSetId = body.khSetId as string | undefined;
  const platform = body.platform as string | undefined;
  const filters = body.filters as Record<string, boolean> | undefined;

  // Build the where clause: find Results NOT yet completed for this workflow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    NOT: {
      enrichmentRuns: {
        some: {
          workflow,
          status: { in: ["completed", "running", "pending"] },
        },
      },
    },
  };

  if (khSetId) where.khSetId = khSetId;
  if (platform) where.platform = { contains: platform, mode: "insensitive" };

  if (filters?.hasEmail === true) {
    where.email = { not: null };
  } else if (filters?.hasEmail === false) {
    where.OR = [{ email: null }, { email: "" }];
  }

  if (filters?.hasCrawlTargets === true) {
    where.crawlTargets = { not: null };
  }

  if (filters?.hasAffinityProfile === true) {
    where.affinityProfile = { not: null };
  } else if (filters?.hasAffinityProfile === false) {
    where.affinityProfile = null;
  }

  // Find eligible results
  const results = await prisma.result.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platformId: true,
      platform: true,
      creatorName: true,
      creatorHandle: true,
      profileUrl: true,
      email: true,
      bio: true,
      rawText: true,
      hashtags: true,
      crawlTargets: true,
      followers: true,
      engagementRate: true,
      affinityProfile: true,
    },
  });

  if (results.length === 0) {
    return NextResponse.json({ runs: [], total: 0 });
  }

  // Create EnrichmentRun records
  const runs = [];
  for (const result of results) {
    const run = await prisma.enrichmentRun.create({
      data: {
        resultId: result.id,
        workflow,
        status: "pending",
        input: result as Record<string, unknown>,
      },
    });

    runs.push({
      enrichmentRunId: run.id,
      resultId: result.id,
      creatorData: result,
    });
  }

  return NextResponse.json({ runs, total: runs.length });
}

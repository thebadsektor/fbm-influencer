import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";

const COST_PER_CHANNEL = 0.005; // Conservative estimate for Apify dataovercoffee actor
const N8N_ENRICHMENT_WEBHOOK_ID = process.env.N8N_ENRICHMENT_WEBHOOK_ID || "youtube-email-enrichment";

/**
 * Start email enrichment for a campaign's YouTube leads.
 *
 * POST body:
 * {
 *   workflow: "youtube-email-scraper",
 *   batchSize: number (default 50, max 200),
 *   confirm: boolean (must be true to actually run — first call without confirm returns estimate)
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const workflow = (body.workflow as string) || "youtube-email-scraper";
  const batchSize = Math.min(Number(body.batchSize) || 50, 200);
  const confirm = body.confirm === true;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
    include: { khSets: { select: { id: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSetIds = campaign.khSets.map((s) => s.id);

  // Find YouTube results without email and without a pending/completed enrichment run
  const eligibleResults = await prisma.result.findMany({
    where: {
      khSetId: { in: khSetIds },
      platform: { contains: "YOUTUBE", mode: "insensitive" },
      OR: [{ email: null }, { email: "" }],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow,
            status: { in: ["pending", "running", "completed"] },
          },
        },
      },
    },
    select: {
      id: true,
      platformId: true,
      creatorName: true,
      creatorHandle: true,
      followers: true,
      crawlTargets: true,
      campaignFitScore: true,
    },
    orderBy: [
      { campaignFitScore: { sort: "desc", nulls: "last" } },
      { followers: { sort: "desc", nulls: "last" } },
    ],
    take: batchSize,
  });

  // Filter to only those with a valid platformId (YouTube channel ID)
  const withChannelId = eligibleResults.filter(
    (r) => r.platformId && r.platformId.startsWith("UC")
  );

  if (withChannelId.length === 0) {
    return NextResponse.json({
      message: "No eligible YouTube channels found for enrichment",
      count: 0,
    });
  }

  const estimatedCost = Math.round(withChannelId.length * COST_PER_CHANNEL * 1000) / 1000;

  // If not confirmed, return estimate only
  if (!confirm) {
    return NextResponse.json({
      count: withChannelId.length,
      estimatedCost,
      channels: withChannelId.map((r) => ({
        platformId: r.platformId,
        name: r.creatorName,
        handle: r.creatorHandle,
      })),
      message: `Ready to enrich ${withChannelId.length} YouTube channels. Estimated cost: ~$${estimatedCost.toFixed(2)}`,
    });
  }

  // Create EnrichmentRun records
  const enrichmentRunMap: Record<string, { enrichmentRunId: string; resultId: string }> = {};

  for (const result of withChannelId) {
    const run = await prisma.enrichmentRun.create({
      data: {
        resultId: result.id,
        workflow,
        status: "pending",
        input: JSON.parse(JSON.stringify({ platformId: result.platformId, name: result.creatorName })),
      },
    });
    enrichmentRunMap[result.platformId!] = {
      enrichmentRunId: run.id,
      resultId: result.id,
    };
  }

  // POST to n8n webhook
  const webhookId = N8N_ENRICHMENT_WEBHOOK_ID;
  const baseUrl = process.env.N8N_BASE_URL;

  if (!webhookId || !baseUrl) {
    return NextResponse.json(
      { error: "N8N_ENRICHMENT_WEBHOOK_ID or N8N_BASE_URL not configured" },
      { status: 500 }
    );
  }

  const channels = withChannelId.map((r) => r.platformId!);

  const n8nPayload = {
    channels,
    enrichmentRunMap,
    callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-enrichment`,
    workflow,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_API_KEY) headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;

  try {
    const resp = await fetch(`${baseUrl}/webhook/${webhookId}`, {
      method: "POST",
      headers,
      body: JSON.stringify(n8nPayload),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `n8n webhook returned ${resp.status}` },
        { status: 502 }
      );
    }

    // Mark runs as "running"
    await prisma.enrichmentRun.updateMany({
      where: {
        id: { in: Object.values(enrichmentRunMap).map((r) => r.enrichmentRunId) },
      },
      data: { status: "running" },
    });

    return NextResponse.json({
      ok: true,
      count: channels.length,
      estimatedCost,
      message: `Enrichment started for ${channels.length} YouTube channels`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to trigger n8n: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

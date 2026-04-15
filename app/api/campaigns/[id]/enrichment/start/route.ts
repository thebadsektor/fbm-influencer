import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { ENRICHMENT_WORKFLOWS } from "@/lib/constants-influencer";

/**
 * Start a manual enrichment batch for a campaign, for any configured workflow
 * (YouTube email scraper, TikTok Linktree, etc.). Resolves webhook URL + platform
 * filter from ENRICHMENT_WORKFLOWS so this path stays in sync with the auto-trigger
 * path in lib/enrichment-runner.ts. No env-var for webhook ID (previous behavior
 * 404'd when the env var was unset or drifted from n8n).
 *
 * POST body:
 * {
 *   workflow: "youtube-email-scraper" | "tiktok-linktree-scraper",
 *   batchSize: number (default 50, max 200),
 *   confirm: boolean (first call without confirm returns estimate only)
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const workflowId = (body.workflow as string) || "youtube-email-scraper";
  const batchSize = Math.min(Number(body.batchSize) || 50, 200);
  const confirm = body.confirm === true;

  const workflow = ENRICHMENT_WORKFLOWS.find((w) => w.id === workflowId);
  if (!workflow) {
    return NextResponse.json(
      { error: `Unknown workflow "${workflowId}". Configured: ${ENRICHMENT_WORKFLOWS.map((w) => w.id).join(", ")}` },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
    include: { khSets: { select: { id: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSetIds = campaign.khSets.map((s) => s.id);
  const platformFilter = (workflow.platform as string) === "ALL"
    ? {}
    : { platform: { contains: workflow.platform, mode: "insensitive" as const } };
  const inputType = (workflow as { inputType?: string }).inputType || "platformId";

  // Find results without email and not already enriched successfully by this workflow
  const eligibleResults = await prisma.result.findMany({
    where: {
      khSetId: { in: khSetIds },
      ...platformFilter,
      OR: [{ email: null }, { email: "" }],
      NOT: {
        enrichmentRuns: {
          some: {
            workflow: workflowId,
            // Don't retry runs that are in-flight or completed/empty (empty = we
            // already confirmed the channel has no public email).
            status: { in: ["pending", "running", "completed", "empty"] },
          },
        },
      },
      ...(inputType === "crawlTargets"
        ? { AND: [{ crawlTargets: { not: null } }, { NOT: { crawlTargets: "" } }] }
        : workflow.platformIdPrefix
          ? { platformId: { startsWith: workflow.platformIdPrefix } }
          : {}),
    },
    select: {
      id: true, platformId: true, creatorName: true, creatorHandle: true,
      followers: true, crawlTargets: true, campaignFitScore: true,
    },
    orderBy: [
      { campaignFitScore: { sort: "desc", nulls: "last" } },
      { followers: { sort: "desc", nulls: "last" } },
    ],
    take: batchSize,
  });

  // For URL-based workflows, require a valid crawlTarget URL. For platformId-based,
  // the platformIdPrefix filter above already narrowed; no extra filter needed.
  const actionable = inputType === "crawlTargets"
    ? eligibleResults.filter((r) => r.crawlTargets && r.crawlTargets.trim())
    : eligibleResults;

  if (actionable.length === 0) {
    return NextResponse.json({
      message: `No eligible ${workflow.label} leads found for enrichment`,
      count: 0,
    });
  }

  const estimatedCost = Math.round(actionable.length * workflow.costPerResult * 1000) / 1000;

  if (!confirm) {
    return NextResponse.json({
      count: actionable.length,
      estimatedCost,
      message: `Ready to enrich ${actionable.length} ${workflow.label} leads. Estimated cost: ~$${estimatedCost.toFixed(2)}`,
    });
  }

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "N8N_BASE_URL not configured" }, { status: 500 });
  }

  // Create EnrichmentRun rows + build the runMap keyed by the identifier n8n will echo back
  const enrichmentRunMap: Record<string, { enrichmentRunId: string; resultId: string }> = {};
  let channels: string[] = [];
  let startUrls: { url: string }[] = [];

  for (const result of actionable) {
    let key: string;
    let input: Record<string, unknown>;
    if (inputType === "crawlTargets") {
      key = result.crawlTargets!.split(",")[0].trim();
      input = { url: key, name: result.creatorName };
      startUrls.push({ url: key });
    } else {
      if (!result.platformId) continue;
      key = result.platformId;
      input = { platformId: result.platformId, name: result.creatorName };
      channels.push(result.platformId);
    }
    const run = await prisma.enrichmentRun.create({
      data: {
        resultId: result.id,
        workflow: workflowId,
        status: "pending",
        input: JSON.parse(JSON.stringify(input)),
      },
    });
    enrichmentRunMap[key] = { enrichmentRunId: run.id, resultId: result.id };
  }

  const n8nPayload: Record<string, unknown> = {
    enrichmentRunMap,
    callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-enrichment`,
    workflow: workflowId,
  };
  if (inputType === "crawlTargets") n8nPayload.urls = startUrls;
  else n8nPayload.channels = channels;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_API_KEY) headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;

  try {
    const resp = await fetch(`${baseUrl}/webhook/${workflow.webhookPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(n8nPayload),
    });

    if (!resp.ok) {
      // Clean up — don't leave rows in "pending" if n8n rejected the trigger
      await prisma.enrichmentRun.updateMany({
        where: { id: { in: Object.values(enrichmentRunMap).map((r) => r.enrichmentRunId) } },
        data: { status: "failed", error: `n8n webhook returned ${resp.status}`, completedAt: new Date() },
      });
      return NextResponse.json(
        { error: `n8n webhook returned ${resp.status} (check workflow.webhookPath in lib/constants-influencer.ts matches the active n8n workflow)` },
        { status: 502 }
      );
    }

    await prisma.enrichmentRun.updateMany({
      where: { id: { in: Object.values(enrichmentRunMap).map((r) => r.enrichmentRunId) } },
      data: { status: "running" },
    });

    const sentCount = inputType === "crawlTargets" ? startUrls.length : channels.length;
    return NextResponse.json({
      ok: true,
      count: sentCount,
      estimatedCost,
      message: `Enrichment started for ${sentCount} ${workflow.label} leads`,
    });
  } catch (err) {
    await prisma.enrichmentRun.updateMany({
      where: { id: { in: Object.values(enrichmentRunMap).map((r) => r.enrichmentRunId) } },
      data: { status: "failed", error: `trigger error: ${err instanceof Error ? err.message : String(err)}`, completedAt: new Date() },
    });
    return NextResponse.json(
      { error: `Failed to trigger n8n: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

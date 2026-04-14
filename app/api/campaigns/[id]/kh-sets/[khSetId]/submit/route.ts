import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { khSetSubmitSchema, parseBody } from "@/lib/validations";
import { publishDiscoveryEvent } from "@/lib/redis";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; khSetId: string }> }
) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: isAdmin(user) ? { id } : { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json();
  const parsed = parseBody(khSetSubmitSchema, raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { platform, testMode } = parsed.data;

  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const webhookId = process.env.N8N_WEBHOOK_ID;
  if (!webhookId) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_ID is not configured" },
      { status: 500 }
    );
  }

  const n8nPayload = {
    "Marketing Goal": campaign.marketingGoal,
    "Brand/Niche": campaign.brandNiche,
    "Target Audience Age": campaign.targetAudienceAge,
    "Target Location": campaign.targetLocation.join(", "),
    "Audience Interests": campaign.audienceInterests.join(", "),
    "Min Followers": campaign.minFollowers,
    "Min Engagement Rate (%)": campaign.minEngagementRate,
    "Number of Influencers": campaign.numberOfInfluencers,
    "Trending Topics/Hashtags": set.hashtags.join(", "),
    "Competitor Brands/Creators": campaign.competitorBrands || "",
    "Additional Keywords": set.keywords.join(", "),
    platform,
    khSetId: set.id,
    callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-callback`,
  };

  const baseUrl = process.env.N8N_BASE_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.N8N_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const webhookPath = testMode ? "webhook-test" : "webhook";
    const response = await fetch(`${baseUrl}/${webhookPath}/${webhookId}`, {
      method: "POST",
      headers,
      body: JSON.stringify(n8nPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      await prisma.kHSet.update({
        where: { id: khSetId },
        data: { status: "failed" },
      });
      return NextResponse.json(
        {
          error: "n8n webhook returned an error",
          details: `Status ${response.status}`,
        },
        { status: 502 }
      );
    }

    // n8n acknowledged — lock the set and mark as processing
    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { status: "processing", locked: true, platform },
    });

    await publishDiscoveryEvent(khSetId, "started", `Discovery started — ${set.keywords.length} keywords, ${set.hashtags.length} hashtags on ${platform}`, {
      keywords: set.keywords.length,
      hashtags: set.hashtags.length,
      platform,
    });

    return NextResponse.json({ ok: true, status: "processing" });
  } catch (error) {
    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { status: "failed" },
    });

    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "n8n webhook timed out (30s) — is the workflow active?"
        : String(error);

    return NextResponse.json(
      { error: "Failed to submit to n8n", details: message },
      { status: 500 }
    );
  }
}

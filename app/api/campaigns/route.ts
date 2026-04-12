import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { generateKHSet } from "@/lib/kh-generator";
import { LLMProvider } from "@/lib/llm";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { campaignCreateSchema, parseBody } from "@/lib/validations";
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from "@/lib/subscription-tiers";

export async function GET() {
  const user = await getRequiredUser();

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { khSets: true, documents: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const user = await getRequiredUser();

  const raw = await req.json();
  const parsed = parseBody(campaignCreateSchema, raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  // Enforce campaign limit per tier (admins bypass all limits)
  if (!isAdmin(user)) {
    const tier = user.plan as SubscriptionTier;
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    if (tierConfig.maxCampaigns !== -1) {
      const count = await prisma.campaign.count({ where: { userId: user.id } });
      if (count >= tierConfig.maxCampaigns) {
        return NextResponse.json(
          { error: `Campaign limit reached (${tierConfig.maxCampaigns} for ${tierConfig.label} plan). Upgrade to create more.` },
          { status: 403 }
        );
      }
    }
  }

  // Create campaign with optional document in a single transaction
  let campaign;
  try {
    campaign = await prisma.$transaction(async (tx) => {
      const c = await tx.campaign.create({
        data: {
          userId: user.id,
          name: body.name,
          marketingGoal: body.marketingGoal,
          brandNiche: body.brandNiche,
          targetAudienceAge: body.targetAudienceAge,
          targetLocation: body.targetLocation,
          audienceInterests: body.audienceInterests,
          minFollowers: body.minFollowers,
          minEngagementRate: body.minEngagementRate ?? 3,
          numberOfInfluencers: body.numberOfInfluencers ?? 25,
          targetKeywords: body.targetKeywords ?? 50,
          targetHashtags: body.targetHashtags ?? 50,
          targetLeads: body.targetLeads ?? 2000,
          trendingTopics: body.trendingTopics,
          competitorBrands: body.competitorBrands,
          additionalKeywords: body.additionalKeywords,
        },
      });

      // If a document was analyzed during creation, attach it
      if (body.documentContent && body.documentFilename) {
        await tx.document.create({
          data: {
            campaignId: c.id,
            filename: body.documentFilename,
            mimeType: body.documentMimeType || "text/plain",
            content: body.documentContent,
          },
        });
      }

      return c;
    });
  } catch (err) {
    console.error("[campaign-create] Transaction failed:", err);
    return NextResponse.json(
      { error: "Failed to create campaign. Please try again." },
      { status: 500 }
    );
  }

  // Auto-generate first KH set if a document was provided (outside transaction — LLM calls are slow)
  if (body.documentContent) {
    try {
      const provider: LLMProvider = body.provider ?? "openai";
      const targetKw = body.targetKeywords ?? 50;
      const targetHt = body.targetHashtags ?? 50;

      const khSet = await generateKHSet({
        campaignId: campaign.id,
        campaign,
        documentContents: [body.documentContent],
        minKeywords: targetKw,
        maxKeywords: targetKw,
        minHashtags: targetHt,
        maxHashtags: targetHt,
        provider,
        userId: user.id,
      });

      // Auto-submit the KH set for discovery
      try {
        const webhookId = process.env.N8N_WEBHOOK_ID;
        const baseUrl = process.env.N8N_BASE_URL;
        if (webhookId && baseUrl) {
          const n8nPayload = {
            "Marketing Goal": campaign.marketingGoal,
            "Brand/Niche": campaign.brandNiche,
            "Target Audience Age": campaign.targetAudienceAge,
            "Target Location": campaign.targetLocation.join(", "),
            "Audience Interests": campaign.audienceInterests.join(", "),
            "Min Followers": campaign.minFollowers,
            "Min Engagement Rate (%)": campaign.minEngagementRate,
            "Number of Influencers": campaign.numberOfInfluencers,
            "Trending Topics/Hashtags": khSet.hashtags.join(", "),
            "Competitor Brands/Creators": campaign.competitorBrands || "",
            "Additional Keywords": khSet.keywords.join(", "),
            platform: "both",
            khSetId: khSet.id,
            callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-callback`,
          };

          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (process.env.N8N_API_KEY) headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;

          const resp = await fetch(`${baseUrl}/webhook/${webhookId}`, {
            method: "POST", headers, body: JSON.stringify(n8nPayload),
          });

          if (resp.ok) {
            await prisma.kHSet.update({
              where: { id: khSet.id },
              data: { status: "processing", locked: true, platform: "both" },
            });
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: "discovering" },
            });
          }
        }
      } catch (submitErr) {
        console.error("[campaign-create] Auto-submit to n8n failed:", submitErr);
      }

      return NextResponse.json(
        { ...campaign, autoGeneratedKhSetId: khSet.id },
        { status: 201 }
      );
    } catch (err) {
      // KH generation failed — still return the campaign, just without auto-generated set
      console.error("[campaign-create] Auto KH generation failed:", err);
      return NextResponse.json(campaign, { status: 201 });
    }
  }

  return NextResponse.json(campaign, { status: 201 });
}

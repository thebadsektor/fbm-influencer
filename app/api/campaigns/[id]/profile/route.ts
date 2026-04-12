import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { profileBatch, type CampaignContext } from "@/lib/affinity-profiler";

/**
 * Manually trigger AI affinity profiling for a specific KH set's results.
 * Useful for re-profiling or profiling older sets.
 *
 * POST body: { khSetId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const { khSetId } = (await req.json()) as { khSetId: string };

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = await prisma.result.findMany({
    where: { khSetId, affinityProfile: { equals: Prisma.DbNull } },
    select: {
      id: true, platform: true, platformId: true,
      creatorName: true, creatorHandle: true,
      bio: true, rawText: true, hashtags: true,
      followers: true, engagementRate: true,
    },
  });

  if (results.length === 0) {
    return NextResponse.json({ message: "All results already profiled", profiledCount: 0 });
  }

  const campaignContext: CampaignContext = {
    name: campaign.name,
    marketingGoal: campaign.marketingGoal,
    brandNiche: campaign.brandNiche,
    targetAudienceAge: campaign.targetAudienceAge,
    targetLocation: campaign.targetLocation,
    audienceInterests: campaign.audienceInterests,
  };

  const profilingResult = await profileBatch(results, campaignContext, {
    userId: user.id,
    khSetId,
  });

  return NextResponse.json(profilingResult);
}

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";

/**
 * Get qualified leads for a KH set — creators with campaignFitScore >= threshold.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; khSetId: string }> }
) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;
  const url = new URL(req.url);
  const minScore = Number(url.searchParams.get("minScore") || 60);
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);

  const campaign = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [results, total] = await Promise.all([
    prisma.result.findMany({
      where: { khSetId, campaignFitScore: { gte: minScore } },
      orderBy: { campaignFitScore: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.result.count({
      where: { khSetId, campaignFitScore: { gte: minScore } },
    }),
  ]);

  return NextResponse.json({ results, total, page, limit });
}

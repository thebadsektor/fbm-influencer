import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";

/**
 * List qualified leads with email + their draft status. Paginated.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
  const filter = url.searchParams.get("filter") || "all"; // all | draft | sent | none

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSets = await prisma.kHSet.findMany({ where: { campaignId: id }, select: { id: true } });
  const khSetIds = khSets.map((s) => s.id);

  // Base query: qualified leads with email
  const baseWhere = {
    khSetId: { in: khSetIds },
    campaignFitScore: { gte: 60 },
    email: { not: null },
    NOT: { email: "" },
  };

  const [results, total] = await Promise.all([
    prisma.result.findMany({
      where: baseWhere,
      select: {
        id: true,
        creatorName: true,
        creatorHandle: true,
        platform: true,
        email: true,
        followers: true,
        campaignFitScore: true,
        profileUrl: true,
        affinityProfile: true,
        emailDrafts: {
          where: { campaignId: id },
          select: { id: true, subject: true, status: true, version: true, updatedAt: true },
          take: 1,
        },
      },
      orderBy: { campaignFitScore: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.result.count({ where: baseWhere }),
  ]);

  // Count by draft status
  const allDrafts = await prisma.emailDraft.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: true,
  });
  const statusCounts = Object.fromEntries(allDrafts.map((d) => [d.status, d._count]));

  return NextResponse.json({
    results: results.map((r) => ({
      ...r,
      draft: r.emailDrafts[0] || null,
      emailDrafts: undefined,
    })),
    total,
    page,
    limit,
    statusCounts: {
      draft: statusCounts["draft"] || 0,
      approved: statusCounts["approved"] || 0,
      sent: statusCounts["sent"] || 0,
      total: Object.values(statusCounts).reduce((s, c) => s + c, 0),
    },
  });
}

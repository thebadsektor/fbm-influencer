import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";

/**
 * Outreach dashboard summary — one call, everything needed to render the
 * Dashboard view of OutreachModal.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
    select: { id: true, outreachPrompt: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSets = await prisma.kHSet.findMany({
    where: { campaignId: id },
    select: { id: true },
  });
  const khSetIds = khSets.map((s) => s.id);

  const STALE_DAYS = 7;
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);

  const sendsSince = new Date();
  sendsSince.setDate(sendsSince.getDate() - 13); // include today = 14 buckets

  const [eligible, statusGroup, providerGroup, sentDrafts, failedDrafts, staleDrafts] =
    await Promise.all([
      prisma.result.count({
        where: {
          khSetId: { in: khSetIds },
          campaignFitScore: { gte: 60 },
          email: { not: null },
          NOT: { email: "" },
        },
      }),
      prisma.emailDraft.groupBy({
        by: ["status"],
        where: { campaignId: id },
        _count: true,
      }),
      prisma.emailDraft.groupBy({
        by: ["provider"],
        where: { campaignId: id },
        _count: true,
      }),
      prisma.emailDraft.findMany({
        where: {
          campaignId: id,
          status: "sent",
          sentAt: { gte: sendsSince },
        },
        select: { sentAt: true },
      }),
      prisma.emailDraft.findMany({
        where: { campaignId: id, status: "failed" },
        select: {
          id: true,
          resultId: true,
          sendError: true,
          updatedAt: true,
          result: {
            select: {
              creatorHandle: true,
              creatorName: true,
              platform: true,
              campaignFitScore: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.emailDraft.findMany({
        where: {
          campaignId: id,
          status: "draft",
          updatedAt: { lt: staleCutoff },
        },
        select: {
          id: true,
          resultId: true,
          updatedAt: true,
          result: {
            select: {
              creatorHandle: true,
              creatorName: true,
              platform: true,
              campaignFitScore: true,
            },
          },
        },
        orderBy: { updatedAt: "asc" },
        take: 10,
      }),
    ]);

  const statusCounts = {
    draft: 0,
    approved: 0,
    sent: 0,
    failed: 0,
    total: 0,
  };
  for (const row of statusGroup) {
    const key = row.status as keyof typeof statusCounts;
    if (key in statusCounts) statusCounts[key] = row._count;
    statusCounts.total += row._count;
  }

  // Sends over last 14 days — bucket by YYYY-MM-DD
  const dayMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of sentDrafts) {
    if (!s.sentAt) continue;
    const key = s.sentAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const sendsByDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

  const providers: Record<string, number> = {};
  for (const row of providerGroup) {
    if (row.provider) providers[row.provider] = row._count;
  }

  // Estimated cost — mirrors outreach-generator.ts line 191
  const estimatedCost = (statusCounts.total - statusCounts.failed) * 0.001;

  return NextResponse.json({
    eligible,
    statusCounts,
    sendsByDay,
    failed: failedDrafts.map((d) => ({
      draftId: d.id,
      resultId: d.resultId,
      creatorHandle: d.result.creatorHandle,
      creatorName: d.result.creatorName,
      platform: d.result.platform,
      campaignFitScore: d.result.campaignFitScore,
      sendError: d.sendError,
      updatedAt: d.updatedAt.toISOString(),
    })),
    stale: staleDrafts.map((d) => ({
      draftId: d.id,
      resultId: d.resultId,
      creatorHandle: d.result.creatorHandle,
      creatorName: d.result.creatorName,
      platform: d.result.platform,
      campaignFitScore: d.result.campaignFitScore,
      updatedAt: d.updatedAt.toISOString(),
    })),
    providers,
    estimatedCost,
    promptIsCustom: !!campaign.outreachPrompt,
  });
}

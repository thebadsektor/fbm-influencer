import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";

/**
 * Get detailed enrichment data: enriched contacts, attempted contacts,
 * success rate insights, and email source breakdown.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") || "enriched"; // enriched | attempted | insights

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const khSets = await prisma.kHSet.findMany({
    where: { campaignId: id },
    select: { id: true },
  });
  const khSetIds = khSets.map((s) => s.id);

  if (tab === "enriched") {
    // Contacts that have emails — from any source
    const results = await prisma.result.findMany({
      where: {
        khSetId: { in: khSetIds },
        email: { not: null },
        NOT: { email: "" },
      },
      select: {
        id: true,
        creatorName: true,
        creatorHandle: true,
        platform: true,
        email: true,
        emailSource: true,
        followers: true,
        campaignFitScore: true,
        profileUrl: true,
      },
      orderBy: { campaignFitScore: { sort: "desc", nulls: "last" } },
    });

    return NextResponse.json({ results, total: results.length });
  }

  if (tab === "attempted") {
    // Contacts that were sent to enrichment but no email found
    const results = await prisma.result.findMany({
      where: {
        khSetId: { in: khSetIds },
        OR: [{ email: null }, { email: "" }],
        enrichmentRuns: {
          some: { status: "completed" },
        },
      },
      select: {
        id: true,
        creatorName: true,
        creatorHandle: true,
        platform: true,
        followers: true,
        campaignFitScore: true,
        profileUrl: true,
        enrichmentRuns: {
          where: { status: "completed" },
          select: { workflow: true, completedAt: true },
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { campaignFitScore: { sort: "desc", nulls: "last" } },
    });

    return NextResponse.json({ results, total: results.length });
  }

  if (tab === "insights") {
    // Email source breakdown
    const allWithEmail = await prisma.result.findMany({
      where: { khSetId: { in: khSetIds }, email: { not: null }, NOT: { email: "" } },
      select: { emailSource: true },
    });

    const sourceBreakdown: Record<string, number> = {};
    for (const r of allWithEmail) {
      const src = r.emailSource || "unknown";
      const label = src === "profile_bio" ? "Bio Parsing"
        : src === "video_description" ? "Video Description"
        : src === "apify-dataovercoffee" ? "YouTube Enrichment"
        : src === "apify-linktree-scraper" ? "Linktree Enrichment"
        : src === "profile_data" ? "Profile Data"
        : src;
      sourceBreakdown[label] = (sourceBreakdown[label] || 0) + 1;
    }

    // Enrichment success rate by follower tier
    const completedRuns = await prisma.enrichmentRun.findMany({
      where: {
        status: "completed",
        result: { khSetId: { in: khSetIds } },
      },
      select: {
        output: true,
        result: { select: { followers: true } },
      },
    });

    const tiers: Record<string, { total: number; found: number }> = {
      "< 10K": { total: 0, found: 0 },
      "10K-100K": { total: 0, found: 0 },
      "100K-1M": { total: 0, found: 0 },
      "1M+": { total: 0, found: 0 },
    };

    for (const run of completedRuns) {
      const f = parseInt(run.result.followers || "0");
      const tier = f < 10000 ? "< 10K" : f < 100000 ? "10K-100K" : f < 1000000 ? "100K-1M" : "1M+";
      tiers[tier].total++;
      const output = run.output as Record<string, unknown> | null;
      if (output?.email && output.email !== "null") tiers[tier].found++;
    }

    const followerTierStats = Object.entries(tiers).map(([tier, data]) => ({
      tier,
      total: data.total,
      found: data.found,
      rate: data.total > 0 ? Math.round((data.found / data.total) * 1000) / 10 : 0,
    }));

    // Total stats
    const totalResults = await prisma.result.count({ where: { khSetId: { in: khSetIds } } });
    const totalWithEmail = allWithEmail.length;
    const totalEnriched = completedRuns.length;
    const totalEmailsFromEnrichment = completedRuns.filter((r) => {
      const o = r.output as Record<string, unknown> | null;
      return o?.email && o.email !== "null";
    }).length;

    return NextResponse.json({
      sourceBreakdown,
      followerTierStats,
      summary: {
        totalResults,
        totalWithEmail,
        totalEnriched,
        totalEmailsFromEnrichment,
        bioParsingRate: totalResults > 0 ? Math.round(((sourceBreakdown["Bio Parsing"] || 0) / totalResults) * 1000) / 10 : 0,
        enrichmentSuccessRate: totalEnriched > 0 ? Math.round((totalEmailsFromEnrichment / totalEnriched) * 1000) / 10 : 0,
      },
    });
  }

  return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
}

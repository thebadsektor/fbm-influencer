import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { verifyN8nRequest } from "@/lib/verify-n8n-signature";
import { n8nCallbackSchema, parseBody } from "@/lib/validations";
import { publishDiscoveryEvent } from "@/lib/redis";

// Known test/placeholder handles to filter out
const TEST_HANDLES = new Set(["n8ntest", "echobot"]);

export async function POST(req: NextRequest) {
  const verified = await verifyN8nRequest(req);
  if (!verified.ok) return verified.response;

  const parsed = parseBody(n8nCallbackSchema, verified.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { khSetId, results, platform, error } = parsed.data;

  const set = await prisma.kHSet.findUnique({
    where: { id: khSetId },
    include: { campaign: true },
  });
  if (!set) return NextResponse.json({ error: "KH set not found" }, { status: 404 });

  if (error) {
    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { status: "failed" },
    });
    await publishDiscoveryEvent(khSetId, "error", `Discovery failed: ${error}`);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // Filter out known test/placeholder accounts
  const cleanResults = Array.isArray(results)
    ? results.filter((r) => {
        const rec = r as Record<string, unknown>;
        const handle = String(rec.creatorHandle || rec.handle || rec.username || "")
          .replace(/^@/, "").toLowerCase();
        return !TEST_HANDLES.has(handle);
      })
    : [];

  // Store results — this is the ONLY thing individual callbacks do
  let storedCount = 0;
  for (const r of cleanResults) {
    const rec = r as Record<string, unknown>;
    try {
      await prisma.result.create({
        data: {
          khSetId,
          platform:
            (rec.platform as string) || platform || set.platform || "unknown",
          platformId: rec.platformId as string | undefined,
          creatorName: (rec.creatorName || rec.name) as string | undefined,
          creatorHandle: (rec.creatorHandle || rec.handle || rec.username) as string | undefined,
          profileUrl: (rec.profileUrl || rec.url) as string | undefined,
          email: rec.email as string | undefined,
          emailSource: (rec.emailSource || rec.source) as string | undefined,
          emailType: rec.emailType as string | undefined,
          confidence: rec.confidence as string | undefined,
          followers: rec.followers ? String(rec.followers) : null,
          engagementRate: rec.engagementRate ? String(rec.engagementRate) : null,
          bio: rec.bio as string | undefined,
          rawText: rec.rawText as string | undefined,
          hashtags: Array.isArray(rec.hashtags)
            ? (rec.hashtags as string[]).join(", ")
            : (rec.hashtags as string | undefined),
          crawlTargets: rec.crawlTargets as string | undefined,
          verified: rec.verified as boolean | undefined,
          avatar: rec.avatar as string | undefined,
          videoCount: rec.videoCount != null ? Number(rec.videoCount) : null,
          totalViews: rec.totalViews != null ? Number(rec.totalViews) : null,
          avgViews: rec.avgViews != null ? Number(rec.avgViews) : null,
          avgLikes: rec.avgLikes != null ? Number(rec.avgLikes) : null,
          topVideoViews: rec.topVideoViews != null ? Number(rec.topVideoViews) : null,
          scrapeHits: rec.scrapeHits != null ? Number(rec.scrapeHits) : null,
          recentActivity: rec.recentActivity as string | undefined,
          rawData: rec as Prisma.InputJsonValue,
        },
      });
      storedCount++;
    } catch (e) {
      // Skip duplicates or errors for individual results
      console.error("[n8n-callback] Error storing result:", e);
    }
  }

  // Update running count (INCREMENT, not overwrite)
  if (storedCount > 0) {
    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { totalScraped: { increment: storedCount } },
    });

    // Publish progress event (throttled — only every ~50 results)
    const currentTotal = await prisma.result.count({ where: { khSetId } });
    if (currentTotal % 50 < storedCount || storedCount >= 10) {
      await publishDiscoveryEvent(khSetId, "results_batch",
        `Receiving creator data... ${currentTotal} creators found so far`);
    }
  }

  // NO status change to "completed" here
  // NO triggerNextIteration here
  // Completion is detected via stabilization in the GET endpoint

  return NextResponse.json({ ok: true, stored: storedCount });
}

import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { verifyN8nRequest } from "@/lib/verify-n8n-signature";
import { n8nStatsSyncSchema, parseBody } from "@/lib/validations";
import { publishDiscoveryEvent } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const verified = await verifyN8nRequest(req);
  if (!verified.ok) return verified.response;

  const parsed = parseBody(n8nStatsSyncSchema, verified.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { khSetId, totalScraped, qualified, disqualified, missingEmail, enriched, leadPoolUrl, extraStats } =
    parsed.data;

  const set = await prisma.kHSet.findUnique({
    where: { id: khSetId },
    select: { id: true, extraStats: true },
  });
  if (!set) {
    return NextResponse.json({ error: "KH set not found" }, { status: 404 });
  }

  // Build update payload with only provided fields
  const data: Record<string, unknown> = { lastSyncedAt: new Date() };

  if (totalScraped !== undefined) data.totalScraped = totalScraped;
  if (qualified !== undefined) data.qualified = qualified;
  if (disqualified !== undefined) data.disqualified = disqualified;
  if (missingEmail !== undefined) data.missingEmail = missingEmail;
  if (enriched !== undefined) data.enriched = enriched;
  if (leadPoolUrl !== undefined) data.leadPoolUrl = leadPoolUrl;

  // Merge extraStats: read existing, spread new keys over it
  if (extraStats) {
    const existing =
      (set.extraStats as Record<string, number>) ?? {};
    data.extraStats = { ...existing, ...extraStats } as unknown as Prisma.InputJsonValue;
  }

  await prisma.kHSet.update({
    where: { id: khSetId },
    data,
  });

  // Publish stats update to Redis for SSE clients
  const parts: string[] = [];
  if (totalScraped !== undefined) parts.push(`${totalScraped} scraped`);
  if (qualified !== undefined) parts.push(`${qualified} qualified`);
  if (disqualified !== undefined) parts.push(`${disqualified} disqualified`);
  if (missingEmail !== undefined) parts.push(`${missingEmail} missing email`);
  if (enriched !== undefined) parts.push(`${enriched} enriched`);
  const message = parts.length > 0 ? parts.join(", ") : "Stats updated";

  await publishDiscoveryEvent(khSetId, "stats_update", message, {
    totalScraped, qualified, disqualified, missingEmail, enriched,
    ...(extraStats || {}),
  });

  return NextResponse.json({ ok: true });
}

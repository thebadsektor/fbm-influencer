import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { runEnrichmentStep, sweepStaleEnrichmentRuns } from "@/lib/enrichment-runner";

/**
 * Manually retry enrichment for all failed runs in a campaign. Useful when
 * the n8n/Apify side was broken for a while and leads piled up as `failed` —
 * one click requeues everything whose result still has no email and no
 * successful run.
 *
 * Idempotent: `runEnrichmentStep` only creates new EnrichmentRun rows for
 * leads that are not currently in-flight or already successful. Safe to
 * call repeatedly.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latestKhSet = await prisma.kHSet.findFirst({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latestKhSet) {
    return NextResponse.json({ error: "Campaign has no KH sets yet" }, { status: 400 });
  }

  await sweepStaleEnrichmentRuns(id);
  const results = await runEnrichmentStep(id, latestKhSet.id);

  const totalSent = Object.values(results).reduce((sum, r) => sum + r.sent, 0);
  return NextResponse.json({ ok: true, totalSent, results });
}

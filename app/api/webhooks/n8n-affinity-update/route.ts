import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyN8nRequest } from "@/lib/verify-n8n-signature";

/**
 * Receives affinity profile updates from n8n AI Relevance Check v5.
 * Matches creators by platformId and updates their Result record
 * with the structured affinity profile.
 *
 * Expected body:
 * {
 *   platformId: string,
 *   platform: string,
 *   affinityProfile: object (the structured profile JSON),
 *   qualificationNotes: string,
 *   handle?: string
 * }
 *
 * Can also receive an array of updates.
 */
export async function POST(req: NextRequest) {
  const verified = await verifyN8nRequest(req);
  if (!verified.ok) return verified.response;

  const body = verified.body as Record<string, unknown> | Record<string, unknown>[];
  const updates = Array.isArray(body) ? body : [body];

  let matched = 0;
  let skipped = 0;

  for (const update of updates) {
    const platformId = update.platformId as string;
    const handle = update.handle as string | undefined;

    if (!platformId && !handle) {
      skipped++;
      continue;
    }

    // Parse affinity profile — may come as string or object
    let affinityProfile = update.affinityProfile;
    if (typeof affinityProfile === "string") {
      try {
        affinityProfile = JSON.parse(affinityProfile);
      } catch {
        skipped++;
        continue;
      }
    }

    if (!affinityProfile) {
      skipped++;
      continue;
    }

    // Find matching Result records by platformId or handle
    // A creator may appear in multiple KH sets
    const whereClause = platformId
      ? { platformId }
      : handle
        ? { creatorHandle: handle }
        : null;

    if (!whereClause) {
      skipped++;
      continue;
    }

    const results = await prisma.result.findMany({
      where: whereClause,
    });

    if (results.length === 0) {
      skipped++;
      continue;
    }

    // Update all matching records with the affinity profile
    for (const result of results) {
      await prisma.result.update({
        where: { id: result.id },
        data: {
          affinityProfile: JSON.parse(JSON.stringify(affinityProfile)),
        },
      });
    }

    matched += results.length;
  }

  return NextResponse.json({
    ok: true,
    matched,
    skipped,
  });
}

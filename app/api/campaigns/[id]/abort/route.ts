import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";

/**
 * Abort a running discovery campaign.
 *
 * If no KH set is currently processing, immediately sets status to "aborted".
 * If a KH set is processing, sets campaign to "aborting" — the callback handler
 * will stop iteration after the current run completes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      khSets: { where: { status: "processing" } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["discovering", "iterating", "processing"].includes(campaign.status)) {
    return NextResponse.json(
      { error: `Cannot abort campaign in "${campaign.status}" status` },
      { status: 400 }
    );
  }

  const hasProcessingSet = campaign.khSets.length > 0;

  if (hasProcessingSet) {
    // A run is in progress — set to "aborting" and let the callback handle it
    await prisma.campaign.update({
      where: { id },
      data: { status: "aborting" },
    });
    return NextResponse.json({
      ok: true,
      status: "aborting",
      message: "Campaign will stop after current discovery run completes.",
    });
  } else {
    // No active run — abort immediately
    await prisma.campaign.update({
      where: { id },
      data: { status: "aborted" },
    });
    return NextResponse.json({
      ok: true,
      status: "aborted",
      message: "Campaign aborted.",
    });
  }
}

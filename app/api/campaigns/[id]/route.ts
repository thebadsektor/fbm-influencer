import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { campaignPatchSchema, parseBody } from "@/lib/validations";
import { checkKHSetCompletion } from "@/lib/completion-detector";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      documents: true,
      khSets: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { results: true } } },
      },
      iterations: {
        orderBy: { iterationNumber: "asc" },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check for completion on any processing KH sets (stabilization-based)
  for (const set of campaign.khSets) {
    if (set.status === "processing") {
      await checkKHSetCompletion(set.id).catch((err) => {
        console.error("[campaign-get] Completion check error:", err);
      });
    }
  }

  // Re-fetch after potential status changes from completion check
  const refreshed = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: {
      documents: true,
      khSets: { orderBy: { createdAt: "asc" }, include: { _count: { select: { results: true } } } },
      iterations: { orderBy: { iterationNumber: "asc" } },
    },
  });

  return NextResponse.json(refreshed || campaign);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  // Verify ownership
  const existing = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json();
  const parsed = parseBody(campaignPatchSchema, raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Filter out undefined values so Prisma only updates provided fields
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  const campaign = await prisma.campaign.update({
    where: { id },
    data,
  });
  return NextResponse.json(campaign);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const existing = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string; khSetId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const set = await prisma.kHSet.findUnique({
    where: { id: khSetId },
    include: { results: { orderBy: { createdAt: "desc" } } },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(set);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.locked) return NextResponse.json({ error: "KH set is locked" }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.kHSet.update({
    where: { id: khSetId },
    data: {
      ...(body.keywords && { keywords: body.keywords }),
      ...(body.hashtags && { hashtags: body.hashtags }),
    },
  });
  return NextResponse.json(updated);
}

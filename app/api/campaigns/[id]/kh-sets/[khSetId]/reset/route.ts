import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; khSetId: string }> }
) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (set.status !== "processing" && set.status !== "failed") {
    return NextResponse.json(
      { error: "Can only reset a processing or failed KH set" },
      { status: 400 }
    );
  }

  const updated = await prisma.kHSet.update({
    where: { id: khSetId },
    data: { status: "draft", locked: false },
  });

  return NextResponse.json(updated);
}

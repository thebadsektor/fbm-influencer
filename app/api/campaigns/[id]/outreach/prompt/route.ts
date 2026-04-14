import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { DEFAULT_OUTREACH_PROMPT } from "@/lib/outreach-generator";

type Params = { params: Promise<{ id: string }> };

/**
 * Get the outreach prompt for a campaign (custom or default).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
    select: { outreachPrompt: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    prompt: campaign.outreachPrompt || DEFAULT_OUTREACH_PROMPT,
    isCustom: !!campaign.outreachPrompt,
  });
}

/**
 * Update the outreach prompt. Pass null to reset to default.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id } = await params;
  const { prompt } = (await req.json()) as { prompt: string | null };

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.update({
    where: { id },
    data: { outreachPrompt: prompt },
  });

  return NextResponse.json({ ok: true });
}

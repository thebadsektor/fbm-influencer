import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { regenerateDraft } from "@/lib/outreach-generator";

type Params = { params: Promise<{ id: string; draftId: string }> };

/**
 * Get a single draft with full content + history.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, draftId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: {
      result: {
        select: {
          creatorName: true, creatorHandle: true, platform: true,
          email: true, campaignFitScore: true, followers: true,
          profileUrl: true,
        },
      },
    },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  return NextResponse.json(draft);
}

/**
 * Update a draft (subject, body, status).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, draftId } = await params;
  const body = (await req.json()) as { subject?: string; body?: string; status?: string };

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.subject !== undefined) data.subject = body.subject;
  if (body.body !== undefined) data.body = body.body;
  if (body.status !== undefined) data.status = body.status;

  const updated = await prisma.emailDraft.update({
    where: { id: draftId },
    data,
  });

  return NextResponse.json(updated);
}

/**
 * Regenerate a draft with LLM.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getRequiredUser();
  const { id, draftId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await regenerateDraft(draftId, id);
    const updated = await prisma.emailDraft.findUnique({ where: { id: draftId } });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate" },
      { status: 500 }
    );
  }
}

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

/**
 * Send selected email drafts via SendGrid.
 * Body: { draftIds: string[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const { draftIds } = (await req.json()) as { draftIds: string[] };

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!draftIds?.length) {
    return NextResponse.json({ error: "No drafts selected" }, { status: 400 });
  }

  const drafts = await prisma.emailDraft.findMany({
    where: { id: { in: draftIds }, campaignId: id, status: { in: ["draft", "approved"] } },
    include: { result: { select: { email: true, creatorName: true } } },
  });

  let sent = 0;
  let failed = 0;

  for (const draft of drafts) {
    if (!draft.result.email) { failed++; continue; }

    try {
      await sendEmail({
        to: draft.result.email,
        subject: draft.subject,
        body: draft.body,
      });

      await prisma.emailDraft.update({
        where: { id: draft.id },
        data: { status: "sent", sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      await prisma.emailDraft.update({
        where: { id: draft.id },
        data: { status: "failed", sendError: err instanceof Error ? err.message : String(err) },
      });
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: drafts.length });
}

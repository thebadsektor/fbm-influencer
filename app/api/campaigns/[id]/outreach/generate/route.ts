import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { generateOutreachDrafts } from "@/lib/outreach-generator";

/**
 * Generate email drafts for qualified leads.
 * Body: { resultIds?: string[] } — specific leads or all eligible
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;
  const body = (await req.json()) as { resultIds?: string[] };

  const campaign = await prisma.campaign.findFirst({
    where: isAdmin(user) ? { id } : { id, userId: user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await generateOutreachDrafts(id, null, {
      resultIds: body.resultIds,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate drafts" },
      { status: 500 }
    );
  }
}

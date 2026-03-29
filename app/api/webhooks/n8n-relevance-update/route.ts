import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyN8nRequest } from "@/lib/verify-n8n-signature";
import { n8nRelevanceUpdateSchema, parseBody } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const verified = await verifyN8nRequest(req);
  if (!verified.ok) return verified.response;

  const parsed = parseBody(n8nRelevanceUpdateSchema, verified.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { khSetId, qualified } = parsed.data;

  await prisma.kHSet.update({
    where: { id: khSetId },
    data: {
      lastSyncedAt: new Date(),
      ...(qualified
        ? { qualified: { increment: 1 } }
        : { disqualified: { increment: 1 } }),
    },
  });

  return NextResponse.json({ ok: true });
}

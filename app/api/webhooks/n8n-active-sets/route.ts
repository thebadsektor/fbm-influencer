import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyN8nRequest } from "@/lib/verify-n8n-signature";

export async function GET(req: NextRequest) {
  const verified = await verifyN8nRequest(req);
  if (!verified.ok) return verified.response;

  const sets = await prisma.kHSet.findMany({
    where: { status: "processing" },
    select: { id: true },
  });

  return NextResponse.json({
    activeSets: sets.map((s) => ({ khSetId: s.id })),
  });
}

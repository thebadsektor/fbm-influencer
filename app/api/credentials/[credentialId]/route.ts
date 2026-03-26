import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { encrypt } from "@/lib/crypto";

const SAFE_FIELDS = {
  id: true,
  serviceType: true,
  provider: true,
  label: true,
  isPlatform: true,
  isActive: true,
  createdAt: true,
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  const user = await getRequiredUser();
  const { credentialId } = await params;

  const existing = await prisma.credential.findUnique({
    where: { id: credentialId },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.isPlatform) {
    return NextResponse.json(
      { error: "Cannot modify platform credentials" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.label !== undefined) data.label = body.label;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  if (body.value) {
    const { encrypted, iv, authTag } = encrypt(body.value);
    data.encryptedValue = encrypted;
    data.iv = iv;
    data.authTag = authTag;
  }

  const updated = await prisma.credential.update({
    where: { id: credentialId },
    data,
    select: SAFE_FIELDS,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  const user = await getRequiredUser();
  const { credentialId } = await params;

  const existing = await prisma.credential.findUnique({
    where: { id: credentialId },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.isPlatform) {
    return NextResponse.json(
      { error: "Cannot delete platform credentials" },
      { status: 403 }
    );
  }

  await prisma.credential.delete({ where: { id: credentialId } });

  return NextResponse.json({ deleted: true });
}

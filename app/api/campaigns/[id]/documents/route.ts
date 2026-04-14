import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: isAdmin(user) ? { id } : { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let content: string;

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    try {
      content = await extractPdfText(buffer);
    } catch (err) {
      console.error("[documents] PDF extraction failed:", err instanceof Error ? err.message : err);
      content = "[PDF text extraction failed]";
    }
  } else {
    content = buffer.toString("utf-8");
  }

  const doc = await prisma.document.create({
    data: {
      campaignId: id,
      filename: file.name,
      mimeType: file.type || "text/plain",
      content,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: isAdmin(user) ? { id } : { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { documentId } = await req.json();
  if (!documentId) return NextResponse.json({ error: "Missing documentId" }, { status: 400 });

  // Verify the document belongs to this campaign
  const doc = await prisma.document.findFirst({
    where: { id: documentId, campaignId: id },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.document.delete({ where: { id: documentId } });
  return NextResponse.json({ ok: true });
}

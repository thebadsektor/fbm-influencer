import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { LLMProvider } from "@/lib/llm";
import { generateKHSet } from "@/lib/kh-generator";
import { getRequiredUser } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sets = await prisma.kHSet.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { results: true } } },
  });
  return NextResponse.json(sets);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: { documents: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Default to campaign's target counts
  let minKeywords = campaign.targetKeywords ?? 5;
  let maxKeywords = campaign.targetKeywords ?? 5;
  let minHashtags = campaign.targetHashtags ?? 5;
  let maxHashtags = campaign.targetHashtags ?? 5;
  let provider: LLMProvider = "openai";

  try {
    const body = await req.json();
    if (body.minKeywords) minKeywords = Math.max(1, Math.min(50, body.minKeywords));
    if (body.maxKeywords) maxKeywords = Math.max(1, Math.min(50, body.maxKeywords));
    if (body.minHashtags) minHashtags = Math.max(1, Math.min(50, body.minHashtags));
    if (body.maxHashtags) maxHashtags = Math.max(1, Math.min(50, body.maxHashtags));
    if (body.provider) provider = body.provider;
  } catch {
    // No body or invalid JSON — use campaign defaults
  }

  // Ensure min <= max
  if (minKeywords > maxKeywords) maxKeywords = minKeywords;
  if (minHashtags > maxHashtags) maxHashtags = minHashtags;

  try {
    const khSet = await generateKHSet({
      campaignId: id,
      campaign,
      documentContents: campaign.documents.map((d) => d.content),
      minKeywords,
      maxKeywords,
      minHashtags,
      maxHashtags,
      provider,
      userId: user.id,
    });

    return NextResponse.json(khSet, { status: 201 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate KH: ${errMsg}` }, { status: 500 });
  }
}

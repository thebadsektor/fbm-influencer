import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { llmGenerate, parseJsonFromLLM, LLMProvider } from "@/lib/llm";
import { getRequiredUser } from "@/lib/auth-helpers";
import { resolveApiKey } from "@/lib/credential-resolver";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; khSetId: string }> }
) {
  const user = await getRequiredUser();
  const { id, khSetId } = await params;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findFirst({ where: { id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let provider: LLMProvider = "openai";
  try {
    const body = await req.json();
    if (body.provider) provider = body.provider;
  } catch {
    // No body — use default
  }

  const set = await prisma.kHSet.findUnique({
    where: { id: khSetId },
    include: { results: true },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resultsSummary = set.results
    .map(
      (r) =>
        `${r.creatorHandle || r.creatorName || "unknown"} (${r.platform}) - email: ${r.email ? "found" : "none"}, confidence: ${r.confidence || "N/A"}`
    )
    .join("\n");

  const prompt = `You are an influencer marketing specialist. Based on the results from a previous search, generate an OPTIMIZED set of keywords and hashtags.

Campaign: ${campaign.name} (${campaign.brandNiche})
Goal: ${campaign.marketingGoal}
Target: ${campaign.targetAudienceAge}, ${campaign.targetLocation.join(", ")}

Previous keywords used: ${set.keywords.join(", ")}
Previous hashtags used: ${set.hashtags.join(", ")}

Results from previous search (${set.results.length} creators found):
${resultsSummary || "No results yet"}

Analyze what worked (creators found with emails) and what didn't. Generate an improved set of keywords and hashtags that will find MORE relevant creators with contact information.

Return ONLY valid JSON:
{"keywords": ["keyword1", "keyword2"], "hashtags": ["#hashtag1", "#hashtag2"]}`;

  let text: string;
  try {
    const apiKey = await resolveApiKey(user.id, provider);
    text = await llmGenerate(provider, prompt, 1024, apiKey);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate: ${errMsg}` }, { status: 500 });
  }

  let parsed: { keywords: string[]; hashtags: string[] };
  try {
    parsed = parseJsonFromLLM<{ keywords: string[]; hashtags: string[] }>(text);
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }

  const newSet = await prisma.kHSet.create({
    data: {
      campaignId: id,
      keywords: parsed.keywords,
      hashtags: parsed.hashtags,
      parentSetId: khSetId,
    },
  });

  return NextResponse.json(newSet, { status: 201 });
}

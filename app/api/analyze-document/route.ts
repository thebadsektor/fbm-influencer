import { NextRequest, NextResponse } from "next/server";
import { llmGenerate, parseJsonFromLLM, LLMProvider } from "@/lib/llm";
import { extractPdfText } from "@/lib/pdf";
import { getRequiredUser } from "@/lib/auth-helpers";
import { resolveApiKey } from "@/lib/credential-resolver";
import prisma from "@/lib/prisma";
import {
  MARKETING_GOALS,
  AGE_RANGES,
  LOCATIONS,
  INTERESTS,
  FOLLOWER_TIERS,
} from "@/lib/constants-influencer";

export async function POST(req: NextRequest) {
  const user = await getRequiredUser();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const provider = (formData.get("provider") as LLMProvider) || "openai";
  const reanalyze = formData.get("reanalyze") === "true";

  if (!file) return NextResponse.json({ error: "No file provided", errorType: "no_file" }, { status: 400 });

  // Extract text from file
  const buffer = Buffer.from(await file.arrayBuffer());
  let content: string;

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    try {
      content = await extractPdfText(buffer);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.constructor.name : "Unknown";
      console.error("[analyze-document] PDF extraction failed:", {
        errorType: errName,
        message: errMsg,
        bufferSize: buffer.length,
        headerBytes: buffer.slice(0, 5).toString("ascii"),
      });
      return NextResponse.json(
        { error: `PDF extraction failed (${errName}): ${errMsg}`, errorType: "extraction_failed" },
        { status: 422 }
      );
    }
  } else {
    content = buffer.toString("utf-8");
  }

  if (!content || content.trim().length < 10) {
    return NextResponse.json(
      { error: "Document appears to be empty or contains too little text.", errorType: "empty_document" },
      { status: 422 }
    );
  }

  // Check cache (skip if user requested re-analysis)
  if (!reanalyze) {
    try {
      const cached = await prisma.documentAnalysisCache.findUnique({
        where: { filename_fileSize: { filename: file.name, fileSize: buffer.length } },
      });
      if (cached) {
        return NextResponse.json({
          analysis: JSON.parse(cached.analysis),
          documentContent: cached.documentContent,
          documentFilename: file.name,
          documentMimeType: cached.mimeType,
          cached: true,
        });
      }
    } catch (err) {
      console.error("[analyze-document] Cache lookup failed:", err);
    }
  }

  const truncated = content.slice(0, 15000);

  const prompt = `You are an influencer marketing strategist. Analyze this document and extract campaign parameters for an influencer scouting tool.

DOCUMENT:
${truncated}

Based on the document content, fill in ALL of the following fields. Make your best inference from the document. If the document doesn't clearly indicate a value, make a reasonable marketing-oriented guess based on the content.

VALID OPTIONS FOR EACH FIELD:

Marketing Goal (pick one): ${MARKETING_GOALS.join(", ")}

Target Audience Age (pick one): ${AGE_RANGES.join(", ")}

Target Location (pick one or more): ${LOCATIONS.join(", ")}

Audience Interests (pick 2-5 that best match): ${INTERESTS.join(", ")}

Min Followers (pick one): ${FOLLOWER_TIERS.join(", ")}

Return ONLY valid JSON in this exact format, no other text:
{
  "campaignName": "A short descriptive campaign name based on the document",
  "brandNiche": "The brand, product, or niche described in the document",
  "marketingGoal": "one of the valid goals",
  "targetAudienceAge": "one of the valid age ranges",
  "targetLocation": ["one or more valid locations"],
  "audienceInterests": ["2-5 valid interests from the list"],
  "minFollowers": "one of the valid tiers",
  "minEngagementRate": 3,
  "numberOfInfluencers": 25,
  "trendingTopics": "relevant hashtags and trending topics, comma-separated",
  "competitorBrands": "competitor brands or creators mentioned or implied",
  "additionalKeywords": "extra search keywords derived from the document"
}`;

  let text: string;
  try {
    const apiKey = await resolveApiKey(user.id, provider);
    text = await llmGenerate(provider, prompt, 2048, apiKey);
  } catch (err) {
    console.error("[analyze-document] LLM call failed:", err);
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI analysis failed: ${errMsg}`, errorType: "ai_failed" },
      { status: 500 }
    );
  }

  let parsed;
  try {
    parsed = parseJsonFromLLM(text);
  } catch {
    console.error("[analyze-document] Failed to parse LLM response:", text.slice(0, 500));
    return NextResponse.json(
      { error: "AI response was not valid JSON. Please try again.", errorType: "parse_failed" },
      { status: 500 }
    );
  }

  // Cache the result (fire-and-forget)
  prisma.documentAnalysisCache.upsert({
    where: { filename_fileSize: { filename: file.name, fileSize: buffer.length } },
    create: {
      filename: file.name,
      fileSize: buffer.length,
      analysis: JSON.stringify(parsed),
      documentContent: content,
      mimeType: file.type || "text/plain",
    },
    update: {
      analysis: JSON.stringify(parsed),
      documentContent: content,
    },
  }).catch(err => console.error("[analyze-document] Cache write failed:", err));

  return NextResponse.json({
    analysis: parsed,
    documentContent: content,
    documentFilename: file.name,
    documentMimeType: file.type || "text/plain",
  });
}

import prisma from "@/lib/prisma";
import { generateKHSet } from "@/lib/kh-generator";
import type { LLMProvider } from "@/lib/llm";

const MIN_NEW_LEADS_PER_RUN = 10; // Stop if diminishing returns

/**
 * After a discovery run completes, check if we should trigger the next iteration.
 *
 * Runs async — called from n8n-callback webhook after results are stored.
 *
 * Flow:
 * 1. Count total leads across all KH sets for this campaign
 * 2. Check campaign status (abort if "aborting")
 * 3. Check safety limits (max iterations, diminishing returns)
 * 4. If target not met → generate new KH set → submit to n8n
 */
export async function triggerNextIteration(
  campaignId: string,
  completedKhSetId: string,
  newResultCount: number
) {
  // Load campaign with all KH sets
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      khSets: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { results: true } } },
      },
      documents: true,
    },
  });

  if (!campaign) return;

  // Check if campaign is being aborted
  if (campaign.status === "aborting" || campaign.status === "aborted") {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "aborted" },
    });
    return;
  }

  // Count total leads across all completed KH sets
  const totalLeads = campaign.khSets
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s._count.results, 0);

  // Check if target is met
  if (totalLeads >= campaign.targetLeads) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
    console.log(
      `[discovery-loop] Campaign ${campaignId}: target met (${totalLeads}/${campaign.targetLeads})`
    );
    return;
  }

  // Check iteration count
  const completedIterations = campaign.khSets.filter(
    (s) => s.status === "completed"
  ).length;
  if (completedIterations >= campaign.maxIterations) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
    console.log(
      `[discovery-loop] Campaign ${campaignId}: max iterations reached (${completedIterations}/${campaign.maxIterations})`
    );
    return;
  }

  // Check diminishing returns (skip for first run)
  if (completedIterations > 1 && newResultCount < MIN_NEW_LEADS_PER_RUN) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
    console.log(
      `[discovery-loop] Campaign ${campaignId}: diminishing returns (${newResultCount} new leads, min ${MIN_NEW_LEADS_PER_RUN})`
    );
    return;
  }

  // Gather learning context from all previous results
  const allPreviousKeywords = campaign.khSets.flatMap((s) => s.keywords);
  const allPreviousHashtags = campaign.khSets.flatMap((s) => s.hashtags);

  // Get themes and hashtags from scraped content (sample for efficiency)
  const recentResults = await prisma.result.findMany({
    where: { khSetId: completedKhSetId },
    select: { hashtags: true, rawText: true },
    take: 50,
  });

  const topHashtagsFromContent = [
    ...new Set(
      recentResults
        .flatMap((r) => (r.hashtags || "").split(", ").filter(Boolean))
        .slice(0, 20)
    ),
  ];

  // Extract themes from rawText (simple word frequency)
  const themeWords = recentResults
    .map((r) => r.rawText || "")
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const wordFreq = new Map<string, number>();
  for (const w of themeWords) {
    wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }
  const topCreatorThemes = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  // Update campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "iterating" },
  });

  const nextIteration = completedIterations + 1;
  console.log(
    `[discovery-loop] Campaign ${campaignId}: starting iteration ${nextIteration} (${totalLeads}/${campaign.targetLeads} leads)`
  );

  // Generate new KH set with iteration context
  const docContents = campaign.documents.map((d) => d.content);
  const provider: LLMProvider = "openai"; // Default — could be stored on campaign

  try {
    const newSet = await generateKHSet({
      campaignId,
      campaign,
      documentContents: docContents,
      minKeywords: campaign.targetKeywords,
      maxKeywords: campaign.targetKeywords,
      minHashtags: campaign.targetHashtags,
      maxHashtags: campaign.targetHashtags,
      provider,
      iterationNumber: nextIteration,
      previousKeywords: allPreviousKeywords,
      previousHashtags: allPreviousHashtags,
      previousResults: {
        creatorsFound: totalLeads,
        topCreatorThemes,
        topHashtagsFromContent,
      },
    });

    // Auto-submit the new KH set to n8n
    await submitKHSetToN8n(campaignId, newSet.id);
  } catch (err) {
    console.error("[discovery-loop] Iteration failed:", err);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    });
  }
}

/**
 * Submit a KH set to the n8n discovery webhook.
 * Extracted from the submit API route for reuse in auto-iteration.
 */
async function submitKHSetToN8n(campaignId: string, khSetId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });

  if (!campaign || !set) throw new Error("Campaign or KH set not found");

  const webhookId = process.env.N8N_WEBHOOK_ID;
  const baseUrl = process.env.N8N_BASE_URL;
  if (!webhookId || !baseUrl) throw new Error("N8N_WEBHOOK_ID or N8N_BASE_URL not configured");

  const platform = "both"; // Auto-iteration always runs on both platforms

  const n8nPayload = {
    "Marketing Goal": campaign.marketingGoal,
    "Brand/Niche": campaign.brandNiche,
    "Target Audience Age": campaign.targetAudienceAge,
    "Target Location": campaign.targetLocation.join(", "),
    "Audience Interests": campaign.audienceInterests.join(", "),
    "Min Followers": campaign.minFollowers,
    "Min Engagement Rate (%)": campaign.minEngagementRate,
    "Number of Influencers": campaign.numberOfInfluencers,
    "Trending Topics/Hashtags": set.hashtags.join(", "),
    "Competitor Brands/Creators": campaign.competitorBrands || "",
    "Additional Keywords": set.keywords.join(", "),
    platform,
    khSetId: set.id,
    callbackUrl: `${process.env.APP_URL}/api/webhooks/n8n-callback`,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.N8N_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.N8N_API_KEY}`;
  }

  const response = await fetch(`${baseUrl}/webhook/${webhookId}`, {
    method: "POST",
    headers,
    body: JSON.stringify(n8nPayload),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook returned ${response.status}`);
  }

  await prisma.kHSet.update({
    where: { id: khSetId },
    data: { status: "processing", locked: true, platform },
  });
}

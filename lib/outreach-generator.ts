import prisma from "@/lib/prisma";
import { llmGenerate, parseJsonFromLLM, type LLMProvider } from "@/lib/llm";
import { publishDiscoveryEvent } from "@/lib/redis";

const DEFAULT_OUTREACH_PROMPT = `You are writing a personalized outreach email on behalf of a brand for an influencer collaboration campaign.

Campaign context:
- Brand/Niche: {brandNiche}
- Marketing Goal: {marketingGoal}
- Target Audience: {audienceInterests}

Target creator:
- Name: {creatorName} (@{creatorHandle})
- Platform: {platform}
- About them: {summary}
- Their content themes: {contentThemes}
- Why they fit this campaign: {campaignFitReason}
- Campaign fit score: {campaignFitScore}/100

Write a short, friendly, human-sounding email inviting them to collaborate. Rules:
1. Keep it under 150 words
2. Be specific about WHY their content is a good fit — reference their actual themes
3. Don't use generic phrases like "I came across your profile" or "I love your content"
4. Sound like a real person, not a marketing bot
5. Include a clear but soft call-to-action
6. Keep the subject line short and curiosity-driven (not clickbait)

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

interface OutreachResult {
  generated: number;
  skipped: number;
  errors: number;
  cost: number;
}

/**
 * Generate email drafts for qualified leads with email.
 * Batch processes using LLM with concurrency control.
 */
export async function generateOutreachDrafts(
  campaignId: string,
  khSetId: string | null, // for Redis events, null for manual trigger
  options?: {
    resultIds?: string[]; // specific leads to generate for (null = all eligible)
    provider?: LLMProvider;
    concurrency?: number;
  }
): Promise<OutreachResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      marketingGoal: true,
      brandNiche: true,
      audienceInterests: true,
      outreachPrompt: true,
    },
  });
  if (!campaign) throw new Error("Campaign not found");

  const provider = options?.provider ?? "openai";
  const concurrency = options?.concurrency ?? 10;
  const promptTemplate = campaign.outreachPrompt || DEFAULT_OUTREACH_PROMPT;

  // Get all KH set IDs for this campaign
  const allKhSets = await prisma.kHSet.findMany({
    where: { campaignId },
    select: { id: true },
  });
  const allKhSetIds = allKhSets.map((s) => s.id);

  // Find eligible leads: qualified, have email, no existing draft
  const whereClause: Record<string, unknown> = {
    khSetId: { in: allKhSetIds },
    campaignFitScore: { gte: 60 },
    email: { not: null },
    NOT: [
      { email: "" },
      { emailDrafts: { some: { campaignId } } },
    ],
  };

  // If specific resultIds provided, scope to those
  if (options?.resultIds?.length) {
    whereClause.id = { in: options.resultIds };
  }

  const eligible = await prisma.result.findMany({
    where: whereClause,
    select: {
      id: true,
      creatorName: true,
      creatorHandle: true,
      platform: true,
      email: true,
      campaignFitScore: true,
      affinityProfile: true,
    },
    orderBy: { campaignFitScore: { sort: "desc", nulls: "last" } },
  });

  if (eligible.length === 0) return { generated: 0, skipped: 0, errors: 0, cost: 0 };

  const eventKhSetId = khSetId || allKhSetIds[allKhSetIds.length - 1];
  await publishDiscoveryEvent(eventKhSetId, "outreach_started",
    `Generating email drafts for ${eligible.length} qualified leads...`);

  // Concurrency limiter
  let running = 0;
  const queue: (() => void)[] = [];
  const limit = async <T>(fn: () => Promise<T>): Promise<T> => {
    while (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try { return await fn(); } finally {
      running--;
      const next = queue.shift();
      if (next) next();
    }
  };

  let generated = 0;
  let errors = 0;

  const tasks = eligible.map((result) =>
    limit(async () => {
      try {
        const profile = result.affinityProfile as Record<string, unknown> | null;

        // Build personalized prompt
        const prompt = promptTemplate
          .replace("{brandNiche}", campaign.brandNiche)
          .replace("{marketingGoal}", campaign.marketingGoal)
          .replace("{audienceInterests}", campaign.audienceInterests.join(", ") || "General")
          .replace("{creatorName}", result.creatorName || "Creator")
          .replace("{creatorHandle}", result.creatorHandle || "")
          .replace("{platform}", result.platform || "Social Media")
          .replace("{summary}", (profile?.summary as string) || "Content creator")
          .replace("{contentThemes}", ((profile?.content_themes as string[]) || []).join(", ") || "various topics")
          .replace("{campaignFitReason}", (profile?.campaignFitReason as string) || "Good alignment with campaign goals")
          .replace("{campaignFitScore}", String(result.campaignFitScore || 0));

        const text = await llmGenerate(provider, prompt, 512);
        const parsed = parseJsonFromLLM<{ subject: string; body: string }>(text);

        if (!parsed.subject || !parsed.body) throw new Error("Invalid response structure");

        await prisma.emailDraft.create({
          data: {
            resultId: result.id,
            campaignId,
            subject: parsed.subject,
            body: parsed.body,
            status: "draft",
            promptUsed: prompt,
            provider,
            version: 1,
          },
        });

        generated++;

        if (generated % 5 === 0) {
          await publishDiscoveryEvent(eventKhSetId, "outreach_progress",
            `Generated ${generated}/${eligible.length} drafts — latest: @${result.creatorHandle || "?"}`,
            { current: generated, total: eligible.length });
        }
      } catch (err) {
        errors++;
        console.error(`[outreach] Error generating draft for ${result.creatorHandle}:`, err);
      }
    })
  );

  await Promise.all(tasks);

  const cost = generated * 0.001; // ~$0.001 per GPT-4o-mini call

  await publishDiscoveryEvent(eventKhSetId, "outreach_completed",
    `Outreach drafts complete — ${generated} generated, ${errors} errors`,
    { generated, errors, cost });

  return { generated, skipped: eligible.length - generated - errors, errors, cost };
}

/**
 * Regenerate a single draft, saving the previous version to history.
 */
export async function regenerateDraft(
  draftId: string,
  campaignId: string,
  provider?: LLMProvider
): Promise<void> {
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: {
      result: {
        select: {
          creatorName: true, creatorHandle: true, platform: true,
          email: true, campaignFitScore: true, affinityProfile: true,
        },
      },
      campaign: {
        select: { brandNiche: true, marketingGoal: true, audienceInterests: true, outreachPrompt: true },
      },
    },
  });

  if (!draft) throw new Error("Draft not found");

  const promptTemplate = draft.campaign.outreachPrompt || DEFAULT_OUTREACH_PROMPT;
  const profile = draft.result.affinityProfile as Record<string, unknown> | null;

  const prompt = promptTemplate
    .replace("{brandNiche}", draft.campaign.brandNiche)
    .replace("{marketingGoal}", draft.campaign.marketingGoal)
    .replace("{audienceInterests}", draft.campaign.audienceInterests.join(", ") || "General")
    .replace("{creatorName}", draft.result.creatorName || "Creator")
    .replace("{creatorHandle}", draft.result.creatorHandle || "")
    .replace("{platform}", draft.result.platform || "Social Media")
    .replace("{summary}", (profile?.summary as string) || "Content creator")
    .replace("{contentThemes}", ((profile?.content_themes as string[]) || []).join(", ") || "various topics")
    .replace("{campaignFitReason}", (profile?.campaignFitReason as string) || "Good alignment")
    .replace("{campaignFitScore}", String(draft.result.campaignFitScore || 0));

  const text = await llmGenerate(provider || "openai", prompt, 512);
  const parsed = parseJsonFromLLM<{ subject: string; body: string }>(text);

  // Save previous version to history
  const previousVersions = (draft.previousVersions as unknown[] || []);
  previousVersions.push({
    version: draft.version,
    subject: draft.subject,
    body: draft.body,
    generatedAt: draft.updatedAt.toISOString(),
  });

  await prisma.emailDraft.update({
    where: { id: draftId },
    data: {
      subject: parsed.subject,
      body: parsed.body,
      version: draft.version + 1,
      previousVersions: JSON.parse(JSON.stringify(previousVersions)),
      promptUsed: prompt,
      provider: provider || "openai",
    },
  });
}

export { DEFAULT_OUTREACH_PROMPT };

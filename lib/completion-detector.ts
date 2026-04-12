import prisma from "@/lib/prisma";
import { publishDiscoveryEvent } from "@/lib/redis";
import { triggerNextIteration } from "@/lib/discovery-loop";

const STABILIZATION_MS = 45_000; // 45 seconds of no new results = scraping done
const STUCK_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes — retry if stuck this long

/**
 * Check if a KH set's scraping has completed (result count stabilized)
 * or is stuck (no results after timeout).
 *
 * Called on each campaign GET poll.
 */
export async function checkKHSetCompletion(khSetId: string): Promise<void> {
  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!set || set.status !== "processing") return;

  const resultCount = await prisma.result.count({ where: { khSetId } });
  const timeSinceUpdate = Date.now() - new Date(set.updatedAt).getTime();

  // ── Stuck detection: no results after 20 minutes ──
  if (resultCount === 0 && timeSinceUpdate > STUCK_TIMEOUT_MS) {
    await publishDiscoveryEvent(khSetId, "warning",
      `Discovery stuck — no results received after ${Math.round(timeSinceUpdate / 60000)}m. Marking as failed for retry.`);

    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { status: "failed" },
    });

    // Update campaign status so it's not stuck in "discovering"
    await prisma.campaign.update({
      where: { id: set.campaignId },
      data: { status: "failed" },
    });
    return;
  }

  // ── Partial results but stuck: results exist but haven't changed in 20 minutes ──
  if (resultCount > 0 && resultCount === set.totalScraped && timeSinceUpdate > STUCK_TIMEOUT_MS) {
    await publishDiscoveryEvent(khSetId, "warning",
      `Discovery appears stuck with ${resultCount} results (no change for ${Math.round(timeSinceUpdate / 60000)}m). Completing with available data.`);

    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { status: "completed", totalScraped: resultCount },
    });

    await publishDiscoveryEvent(khSetId, "scraping_complete",
      `Scraping recovered — ${resultCount} creators available. Starting AI profiling...`);

    triggerNextIteration(set.campaignId, khSetId, resultCount).catch((err) => {
      console.error("[completion-detector] Iteration trigger failed:", err);
    });
    return;
  }

  if (resultCount === 0) return; // Still waiting for first results

  if (resultCount !== set.totalScraped) {
    // Count changed — update and reset the stabilization timer
    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { totalScraped: resultCount, lastSyncedAt: new Date() },
    });
    return;
  }

  // Count unchanged — check if enough time has passed for stabilization
  const lastUpdate = set.lastSyncedAt || set.updatedAt;
  const elapsed = Date.now() - new Date(lastUpdate).getTime();

  if (elapsed < STABILIZATION_MS) return; // Not stable yet

  // ── Stabilized! Mark complete and trigger pipeline ──

  await prisma.kHSet.update({
    where: { id: khSetId },
    data: { status: "completed", totalScraped: resultCount },
  });

  await publishDiscoveryEvent(khSetId, "scraping_complete",
    `Scraping complete — ${resultCount} creators discovered. Starting AI profiling...`);

  const campaignId = set.campaignId;
  triggerNextIteration(campaignId, khSetId, resultCount).catch((err) => {
    console.error("[completion-detector] Iteration trigger failed:", err);
  });
}

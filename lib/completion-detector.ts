import prisma from "@/lib/prisma";
import { publishDiscoveryEvent } from "@/lib/redis";
import { triggerNextIteration } from "@/lib/discovery-loop";

const STABILIZATION_MS = 45_000; // 45 seconds of no new results = scraping done

/**
 * Check if a KH set's scraping has completed (result count stabilized).
 * Called on each GET poll from the KH set detail page.
 *
 * Flow:
 * 1. Count actual results in DB
 * 2. Compare to stored totalScraped
 * 3. If same → check if enough time passed since last update
 * 4. If stabilized → mark "completed", trigger next iteration pipeline
 */
export async function checkKHSetCompletion(khSetId: string): Promise<void> {
  const set = await prisma.kHSet.findUnique({ where: { id: khSetId } });
  if (!set || set.status !== "processing") return;

  const resultCount = await prisma.result.count({ where: { khSetId } });

  if (resultCount === 0) return; // No results yet

  if (resultCount !== set.totalScraped) {
    // Count changed — update and reset the stabilization timer
    await prisma.kHSet.update({
      where: { id: khSetId },
      data: { totalScraped: resultCount, lastSyncedAt: new Date() },
    });
    return;
  }

  // Count unchanged — check if enough time has passed
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

  // Trigger the intelligence pipeline (profiling → analysis → next iteration)
  const campaignId = set.campaignId;
  triggerNextIteration(campaignId, khSetId, resultCount).catch((err) => {
    console.error("[completion-detector] Iteration trigger failed:", err);
  });
}

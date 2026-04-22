import { NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { getLastCronStatus } from "@/lib/cron-tick";

/**
 * Read-only cron health indicator. Returns the last cron tick's outcome and
 * timestamp so the UI can show "Cron last ran 42s ago" or "Cron has not run
 * since this process started". Auth-gated (any signed-in user) because it
 * leaks no secrets but isn't public-interest either.
 *
 * Intentionally in-memory: if the process has just restarted or the tick
 * has never fired in this replica, `lastCronStatus` is null — which is
 * itself a useful signal in the UI.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  await getRequiredUser();
  const status = getLastCronStatus();
  if (!status) {
    return NextResponse.json({
      configured: Boolean(process.env.CRON_SECRET),
      ranAt: null,
      summary: null,
      ageSeconds: null,
    });
  }
  const ageSeconds = Math.round((Date.now() - new Date(status.ranAt).getTime()) / 1000);
  return NextResponse.json({
    configured: Boolean(process.env.CRON_SECRET),
    ranAt: status.ranAt,
    summary: status.summary,
    ageSeconds,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { runCronTick } from "@/lib/cron-tick";

/**
 * Server-side pipeline advancement tick. Drives discovery → profiling →
 * enrichment forward without needing a browser. Call on a 30–60 s interval
 * from Railway cron, n8n scheduled workflow, or any external pinger.
 *
 * Auth: CRON_SECRET env var. Pass via Authorization: Bearer header OR
 * `?secret=` query param. If CRON_SECRET is unset, the route refuses — we
 * never want an unauthenticated public endpoint kicking off work.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300; // tick can take a while when many campaigns active

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const queryParam = req.nextUrl.searchParams.get("secret") ?? "";

  if (bearer !== secret && queryParam !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runCronTick();
  return NextResponse.json({ ok: true, summary });
}

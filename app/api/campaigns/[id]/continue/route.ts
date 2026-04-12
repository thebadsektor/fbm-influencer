import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
import { continueToNextRound } from "@/lib/discovery-loop";

/**
 * Continue to the next discovery round after the 30s approval timer
 * or user clicking "Start Now".
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    await continueToNextRound(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to continue" },
      { status: 400 }
    );
  }
}

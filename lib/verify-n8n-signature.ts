import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

type VerifyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

/**
 * Verify an incoming n8n webhook request using HMAC-SHA256.
 * If N8N_WEBHOOK_SECRET is not set, verification is skipped.
 * Returns the parsed body on success.
 */
export async function verifyN8nRequest(req: NextRequest): Promise<VerifyResult> {
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (secret) {
    const signature = req.headers.get("x-n8n-signature");
    if (!signature) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Missing x-n8n-signature header" },
          { status: 401 }
        ),
      };
    }

    const rawBody = await req.text();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expected) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        ),
      };
    }

    return { ok: true, body: JSON.parse(rawBody) };
  }

  return { ok: true, body: await req.json() };
}

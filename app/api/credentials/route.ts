import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser, isAdmin } from "@/lib/auth-helpers";
import { encrypt } from "@/lib/crypto";
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from "@/lib/subscription-tiers";

const SAFE_FIELDS = {
  id: true,
  serviceType: true,
  provider: true,
  label: true,
  isPlatform: true,
  isActive: true,
  createdAt: true,
} as const;

export async function GET() {
  try {
    const user = await getRequiredUser();

    // User's own credentials
    const userCreds = await prisma.credential.findMany({
      where: { userId: user.id },
      select: SAFE_FIELDS,
      orderBy: { createdAt: "desc" },
    });

    // Platform credentials available to user's tier (admins see all)
    const tier = user.plan as SubscriptionTier;
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    const allowedProviders: readonly string[] = isAdmin(user)
      ? ["anthropic", "openai", "gemini"]
      : (tierConfig?.platformLlmProviders ?? []);

    let platformCreds: typeof userCreds = [];
    if (allowedProviders.length > 0) {
      platformCreds = await prisma.credential.findMany({
        where: {
          isPlatform: true,
          isActive: true,
          provider: { in: [...allowedProviders] },
          userId: { not: user.id }, // exclude if already in userCreds
        },
        select: SAFE_FIELDS,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({
      credentials: userCreds,
      platformCredentials: platformCreds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequiredUser();

    const raw = await req.json();
    const { credentialCreateSchema, parseBody } = await import("@/lib/validations");
    const parsed = parseBody(credentialCreateSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { serviceType, provider, label, value } = parsed.data;

    const { encrypted, iv, authTag } = encrypt(value);

    // Upsert: if user already has a credential for this provider, update it
    const credential = await prisma.credential.upsert({
      where: {
        userId_provider_isPlatform: {
          userId: user.id,
          provider,
          isPlatform: false,
        },
      },
      update: {
        serviceType,
        label,
        encryptedValue: encrypted,
        iv,
        authTag,
        isActive: true,
      },
      create: {
        userId: user.id,
        serviceType,
        provider,
        label,
        encryptedValue: encrypted,
        iv,
        authTag,
        isPlatform: false,
        isActive: true,
      },
      select: SAFE_FIELDS,
    });

    return NextResponse.json(credential, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save credential";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

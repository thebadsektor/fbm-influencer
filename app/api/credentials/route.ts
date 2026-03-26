import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/auth-helpers";
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
  const user = await getRequiredUser();

  // User's own credentials
  const userCreds = await prisma.credential.findMany({
    where: { userId: user.id },
    select: SAFE_FIELDS,
    orderBy: { createdAt: "desc" },
  });

  // Platform credentials available to user's tier
  const tier = user.plan as SubscriptionTier;
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const allowedProviders = tierConfig?.platformLlmProviders ?? [];

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
}

export async function POST(req: NextRequest) {
  const user = await getRequiredUser();

  const raw = await req.json();
  const { credentialCreateSchema, parseBody } = await import("@/lib/validations");
  const parsed = parseBody(credentialCreateSchema, raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { serviceType, provider, label, value } = parsed.data;

  const { encrypted, iv, authTag } = encrypt(value);

  const credential = await prisma.credential.create({
    data: {
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
}

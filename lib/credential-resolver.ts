import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from "@/lib/subscription-tiers";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export class CredentialNotFoundError extends Error {
  constructor(provider: string) {
    super(
      `No API key available for "${provider}". Add your own key in Credentials, or upgrade your plan.`
    );
    this.name = "CredentialNotFoundError";
  }
}

/**
 * Resolve an API key for the given provider.
 *
 * Priority:
 *   1. User's own key (isPlatform: false, isActive: true)
 *   2. Platform key if user's Stripe plan allows it (isPlatform: true)
 *   3. Throw CredentialNotFoundError
 */
export async function resolveApiKey(
  userId: string,
  provider: string
): Promise<string> {
  // 1. Check for user's own credential
  const userCred = await prisma.credential.findFirst({
    where: { userId, provider, isPlatform: false, isActive: true },
  });

  if (userCred) {
    return decrypt(userCred.encryptedValue, userCred.iv, userCred.authTag);
  }

  // 2. Admin bypass — admins can use any active platform provider unconditionally
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (dbUser?.role === "admin" || dbUser?.role === "super-admin") {
    const platformCred = await prisma.credential.findFirst({
      where: { provider, isPlatform: true, isActive: true },
    });
    if (!platformCred) throw new CredentialNotFoundError(provider);
    return decrypt(
      platformCred.encryptedValue,
      platformCred.iv,
      platformCred.authTag
    );
  }

  // 3. Determine user's plan via Stripe subscriptions
  let plan: string = "free";
  try {
    const subscriptions = await auth.api.listActiveSubscriptions({
      query: { referenceId: userId, customerType: "user" },
      headers: await headers(),
    });
    const active = subscriptions.find(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );
    plan = active?.plan || "free";
  } catch {
    // If subscription lookup fails (e.g. no session context), default to free
    plan = "free";
  }

  const tierConfig = SUBSCRIPTION_TIERS[plan as SubscriptionTier];

  if (!tierConfig || !tierConfig.platformLlmProviders.includes(provider)) {
    throw new CredentialNotFoundError(provider);
  }

  // 4. Fetch the platform credential
  const platformCred = await prisma.credential.findFirst({
    where: { provider, isPlatform: true, isActive: true },
  });

  if (!platformCred) {
    throw new CredentialNotFoundError(provider);
  }

  return decrypt(
    platformCred.encryptedValue,
    platformCred.iv,
    platformCred.authTag
  );
}

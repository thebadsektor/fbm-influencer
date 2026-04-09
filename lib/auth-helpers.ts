import { auth, getActivePlanServer } from "@/lib/auth";
import { headers } from "next/headers";

export interface AppUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  plan: string; // "free" | "plus" | "enterprise"
}

/**
 * Get the current authenticated user from the Better Auth session.
 * Returns null if not authenticated.
 */
export async function getOptionalUser(): Promise<AppUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) return null;

  const plan = await getActivePlanServer();

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role ?? "user",
    plan,
  };
}

/**
 * Get the current authenticated user, or throw.
 * Use in API routes and server components that require auth.
 */
export async function getRequiredUser(): Promise<AppUser> {
  const user = await getOptionalUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Check if the current user has the required role.
 * Throws if not authenticated or insufficient role.
 */
export async function requireRole(...roles: string[]): Promise<AppUser> {
  const user = await getRequiredUser();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Check if a user is an admin (or super-admin).
 * Used to bypass subscription limits for internal accounts.
 */
export function isAdmin(user: { role: string }): boolean {
  return user.role === "admin" || user.role === "super-admin";
}

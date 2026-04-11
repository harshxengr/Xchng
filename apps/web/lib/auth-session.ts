import { auth } from "@workspace/auth";
import type { Session } from "@workspace/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Get the current session. Returns null if not authenticated.
 * Wrapped in React cache() so it's only called once per request
 * even if used in multiple RSCs in the same render tree.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

/**
 * Get session and redirect to /sign-in if not authenticated.
 * Use this in protected pages and layouts.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

/**
 * Get session and redirect to /dashboard if already authenticated.
 * Use this in sign-in / sign-up pages so logged-in users can't see them.
 */
export async function requireGuest(): Promise<void> {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }
}
const OPERATOR_EMAILS = (process.env.OPERATOR_EMAILS || "admin@example.com").split(",");

export function isOperatorSession(session: Session | null): boolean {
  if (!session) return false;
  return OPERATOR_EMAILS.includes(session.user.email);
}

export async function requireOperatorSession(): Promise<Session> {
  const session = await requireSession();
  if (!isOperatorSession(session)) {
    redirect("/dashboard");
  }
  return session;
}

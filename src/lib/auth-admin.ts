import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { resolveHiringSession, verifyHiringSessionToken } from "@/lib/auth-session";
import { env } from "@/lib/env";
import {
  ADMIN_COOKIE,
  type HiringSession,
  type HiringSessionClaims,
  type Role,
  ROLES,
} from "@/lib/hiring-roles";
import { readPageSession } from "@/lib/page-authority";

/**
 * HIRING-SIDE authentication.
 *
 * Page requests are live-validated by Proxy and carry a trusted internal authority
 * snapshot, so render-tree callers never need cookies(). API/handler requests do not
 * receive those headers and therefore fall back to the signed cookie plus live DB
 * session resolution. This keeps existing call sites compatible while preserving
 * hydration and DB-near API authority.
 */
export {
  ADMIN_COOKIE,
  ROLES,
  type HiringSession,
  type HiringSessionClaims,
  type Role,
};

const secret = () => new TextEncoder().encode(env.APP_SECRET);

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createSessionToken(
  claims: HiringSessionClaims,
): Promise<string> {
  return new SignJWT({
    userId: claims.userId,
    sessionVersion: claims.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export const verifySessionToken = verifyHiringSessionToken;

async function currentSession(): Promise<HiringSession | null> {
  const pageSession = await readPageSession();
  if (pageSession) return pageSession;

  const store = await cookies();
  return resolveHiringSession(store.get(ADMIN_COOKIE)?.value);
}

/** Accepts a valid current account even while a forced password change is pending. */
export async function requirePasswordChangeUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

/** Any active hiring user. */
export async function requireHiringUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  if (session.mustChangePassword) throw new Error("Password change required");
  return session;
}

/** ADMIN only. */
export async function requireAdmin(): Promise<HiringSession> {
  const session = await requireHiringUser();
  if (session.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

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

/**
 * HIRING-SIDE authentication for route handlers and password flows.
 *
 * Render-tree authorization uses page-authority.ts instead: Next.js 16 production
 * builds in this app drop client hydration when the cookies() session lookup runs in
 * a page/layout render. API handlers remain safe here and keep the DB-near authority
 * check on every mutation/export.
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
  const store = await cookies();
  return resolveHiringSession(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Used by the password endpoint and other non-render handlers. It accepts a valid
 * current account even while a forced password change is pending.
 */
export async function requirePasswordChangeUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

/** Any active hiring user — for API/DAL operational reads. */
export async function requireHiringUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  if (session.mustChangePassword) throw new Error("Password change required");
  return session;
}

/** ADMIN only — for API/DAL mutations and exports. */
export async function requireAdmin(): Promise<HiringSession> {
  const session = await requireHiringUser();
  if (session.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

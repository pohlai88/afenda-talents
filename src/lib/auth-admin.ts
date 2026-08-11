import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  ADMIN_COOKIE,
  type HiringSession,
  type HiringSessionClaims,
  type Role,
  ROLES,
} from "@/lib/hiring-roles";

/**
 * HIRING-SIDE authentication only. Candidate authentication remains entirely separate.
 *
 * The cookie proves possession of a signed session and carries only identity plus a
 * revocation version. Every server authority check re-reads the User row so deletion,
 * role changes, password resets, and forced-password-change state take effect without
 * waiting for the eight-hour JWT expiry.
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

export async function verifySessionToken(
  token: string | undefined,
): Promise<HiringSessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string") return null;
    if (
      typeof payload.sessionVersion !== "number" ||
      !Number.isInteger(payload.sessionVersion) ||
      payload.sessionVersion < 0
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

async function currentSession(): Promise<HiringSession | null> {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(ADMIN_COOKIE)?.value);
  if (!claims) return null;

  const user = await db.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      role: true,
      mustChangePassword: true,
      sessionVersion: true,
    },
  });
  if (!user || user.sessionVersion !== claims.sessionVersion) return null;

  return {
    userId: user.id,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  };
}

/**
 * Used only by the password-change page and endpoint. It accepts a valid current
 * account even while a forced password change is pending.
 */
export async function requirePasswordChangeUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

/** Any active hiring user — for operational read surfaces. */
export async function requireHiringUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  if (session.mustChangePassword) throw new Error("Password change required");
  return session;
}

/** ADMIN only — for anything that mutates or exports. */
export async function requireAdmin(): Promise<HiringSession> {
  const session = await requireHiringUser();
  if (session.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * HIRING-SIDE authentication only. This file must never reference the other auth
 * system's cookie or claims — the two systems share no code, so a wrong import is
 * visible in review. Spec §6; build-skill invariant 7.
 *
 * Two roles (DECISIONS.md D15): ADMIN acts, VIEWER reads. Candidates are not users.
 */
export const ADMIN_COOKIE = "afenda_admin";

export const ROLES = ["ADMIN", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type HiringSession = { userId: string; role: Role };

const secret = () => new TextEncoder().encode(env.APP_SECRET);

/** Cookie attrs for set/clear — keep Secure in sync with APP_URL scheme. */
export function adminCookieOptions(maxAge: number) {
	return {
		httpOnly: true,
		secure: env.APP_URL.startsWith("https"),
		sameSite: "lax" as const,
		path: "/",
		maxAge,
	};
}

export async function createSessionToken(session: HiringSession): Promise<string> {
  return new SignJWT({ userId: session.userId, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<HiringSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string") return null;
    if (payload.role !== "ADMIN" && payload.role !== "VIEWER") return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

async function currentSession(): Promise<HiringSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/** Any signed-in hiring user — for read surfaces (dashboard, profiles). */
export async function requireHiringUser(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

/** ADMIN only — for anything that mutates or exports. */
export async function requireAdmin(): Promise<HiringSession> {
  const session = await currentSession();
  if (!session || session.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * ADMIN authentication only. This file must never reference the other auth system's
 * cookie or claims — the two systems share no code, so a wrong import is visible
 * in review. Spec §6; build-skill invariant 7.
 */
export const ADMIN_COOKIE = "afenda_admin";

const secret = () => new TextEncoder().encode(env.APP_SECRET);
const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares fixed-width digests so comparison time does not depend on the input. */
export function passwordMatches(submitted: string, expected: string): boolean {
  return timingSafeEqual(digest(submitted), digest(expected));
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** For server components and admin route handlers. */
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const ok = await verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
  if (!ok) throw new Error("Not authenticated as admin");
}

import { headers } from "next/headers";
import type { HiringSession, Role } from "@/lib/hiring-roles";
import { ROLES } from "@/lib/hiring-roles";
import { PAGE_AUTH_HEADERS } from "@/lib/page-auth-headers";

function isRole(value: string | null): value is Role {
  return value !== null && (ROLES as readonly string[]).includes(value);
}

/**
 * Reads the trusted page-authority snapshot stamped by Proxy after live Postgres
 * session validation. Returns null for API/handler requests where Proxy deliberately
 * does not stamp render authority headers.
 */
export async function readPageSession(): Promise<HiringSession | null> {
  const store = await headers();
  if (store.get(PAGE_AUTH_HEADERS.authenticated) !== "1") return null;

  const userId = store.get(PAGE_AUTH_HEADERS.userId);
  const role = store.get(PAGE_AUTH_HEADERS.role);
  const sessionVersionRaw = store.get(PAGE_AUTH_HEADERS.sessionVersion);
  const mustChangePasswordRaw = store.get(PAGE_AUTH_HEADERS.mustChangePassword);

  const sessionVersion = Number(sessionVersionRaw);
  if (
    !userId ||
    !isRole(role) ||
    !Number.isInteger(sessionVersion) ||
    sessionVersion < 0 ||
    (mustChangePasswordRaw !== "0" && mustChangePasswordRaw !== "1")
  ) {
    return null;
  }

  return {
    userId,
    role,
    sessionVersion,
    mustChangePassword: mustChangePasswordRaw === "1",
  };
}

/** Render-tree authority. Proxy has already verified this account against Postgres. */
export async function requirePagePasswordChangeUser(): Promise<HiringSession> {
  const session = await readPageSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

/** Any active hiring user for server-rendered operational pages. */
export async function requirePageHiringUser(): Promise<HiringSession> {
  const session = await requirePagePasswordChangeUser();
  if (session.mustChangePassword) throw new Error("Password change required");
  return session;
}

/** ADMIN-only authority for server-rendered admin pages. */
export async function requirePageAdmin(): Promise<HiringSession> {
  const session = await requirePageHiringUser();
  if (session.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

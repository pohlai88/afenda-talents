import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Candidate } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken } from "@/lib/tokens";

/**
 * CANDIDATE authentication only. This file must never reference the other auth system's
 * cookie or claims — the two systems share no code, so a wrong import is visible in
 * review. Spec §6; build-skill invariant 7.
 */
export const CANDIDATE_COOKIE = "afenda_candidate";

const secret = () => new TextEncoder().encode(env.APP_SECRET);

/** Statuses from which a candidate may still be working. */
const OPEN_STATUSES = new Set(["SENT", "STARTED"]);

/**
 * Resolves a raw path token to a candidate, or null.
 * Null covers: unknown token, expired invitation, revoked, and already finished.
 * Callers must land every null on the same completion page so the cases are
 * indistinguishable from outside.
 */
export async function resolveToken(token: string): Promise<Candidate | null> {
  const candidate = await db.candidate.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!candidate) return null;
  if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) return null;
  if (!OPEN_STATUSES.has(candidate.status)) return null;
  return candidate;
}

export async function createCandidateToken(candidateId: string): Promise<string> {
  return new SignJWT({ candidateId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(secret());
}

export async function currentCandidateId(): Promise<string | null> {
  const value = (await cookies()).get(CANDIDATE_COOKIE)?.value;
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, secret());
    return typeof payload.candidateId === "string" ? payload.candidateId : null;
  } catch {
    return null;
  }
}

/**
 * For /api/candidate/* handlers. The proxy gate has already checked the cookie's
 * signature; this re-reads the row because the gate deliberately does not know about
 * revocation, submission, or expiry (DECISIONS.md D7).
 */
export async function requireCandidate(): Promise<Candidate> {
  const id = await currentCandidateId();
  if (!id) throw new Error("No candidate session");
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) throw new Error("Candidate not found");
  if (!OPEN_STATUSES.has(candidate.status)) throw new Error("Assessment is closed");
  if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) {
    throw new Error("Invitation expired");
  }
  return candidate;
}

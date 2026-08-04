import { createHash, randomBytes } from "node:crypto";

/**
 * Invitation tokens. A raw token exists in exactly two places — the email body and the
 * URL — and is never logged, stored, or audited. Only its hash is persisted.
 * Spec §6; build-skill invariant 2.
 */

/** 32 random bytes, base64url. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The only form of a token that may be persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/a/${token}`;
}

export function expiryFromNow(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

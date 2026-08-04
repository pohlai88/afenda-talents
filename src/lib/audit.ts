import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Audit rows carry identifiers, never identities or secrets.
 *
 * They survive the end-of-round purge as proof the purge happened, so a name or an email
 * here would make the consent text's retention promise false. Raw invitation tokens are
 * banned everywhere. See DECISIONS.md D9; build-skill invariants 2 and 6.
 */
export type AuditAction =
  | "admin.login"
  | "user.password_changed"
  | "invite.created"
  | "invite.resent"
  | "invite.revoked"
  | "candidate.consented"
  | "assessment.submitted"
  | "result.viewed"
  | "export.downloaded"
  | "candidate.deleted"
  | "data.purged"
  | "assessment.seeded"
  | "round.created"
  | "round.opened"
  | "round.closed"
  | "round.archived";

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// A 32-byte base64url token is 43 chars of this alphabet. A sha256 hex digest (the stored,
// safe form) also matches the alphabet, so pure lowercase hex is exempted.
const TOKEN_ALPHABET = /^[A-Za-z0-9_-]{40,}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const BANNED_KEYS = new Set(["email", "fullname", "name", "token", "password"]);

export function assertNoPii(meta: unknown): void {
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (EMAIL_PATTERN.test(value)) {
        throw new Error(`Audit meta at "${path}" looks like an email address`);
      }
      if (TOKEN_ALPHABET.test(value) && !HEX_DIGEST.test(value)) {
        throw new Error(`Audit meta at "${path}" looks like a raw token`);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, v] of Object.entries(value)) {
        if (BANNED_KEYS.has(key.toLowerCase())) {
          throw new Error(`Audit meta must not contain the key "${key}"`);
        }
        walk(v, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(meta, "");
}

export async function audit(
  actor: string,
  action: AuditAction,
  subjectId?: string,
  meta?: Prisma.InputJsonObject,
): Promise<void> {
  assertNoPii(meta);
  await db.auditEvent.create({
    data: { actor, action, subjectId: subjectId ?? null, meta: meta ?? undefined },
  });
}

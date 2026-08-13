import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type AuditAction =
  | "admin.login" | "user.created" | "user.role_changed" | "user.password_reset" | "user.password_changed" | "user.removed"
  | "invite.created" | "invite.resent" | "invite.revoked" | "candidate.consented" | "assessment.submitted" | "result.viewed"
  | "export.downloaded" | "candidate.deleted" | "data.purged" | "assessment.seeded" | "assessment.created" | "assessment.duplicated"
  | "assessment.published" | "assessment.archived" | "draft.validated" | "round.created" | "round.opened" | "round.closed" | "round.archived"
  | "corporate.counterparty.created" | "corporate.counterparty.updated" | "corporate.counterparty.contact.created" | "corporate.counterparty.contact.updated"
  | "corporate.site.created" | "corporate.site.updated" | "corporate.site.coverage.created" | "corporate.site.coverage.updated"
  | "corporate.obligation.created" | "corporate.obligation.updated" | "corporate.obligation.activated" | "corporate.obligation.ended" | "corporate.obligation.cancelled"
  | "corporate.obligation.site.linked" | "corporate.obligation.party.linked" | "corporate.obligation.line.created" | "corporate.obligation.line.updated"
  | "corporate.due_item.created" | "corporate.due_item.updated" | "corporate.payment.requested" | "corporate.payment.approved"
  | "corporate.payment.rejected" | "corporate.payment.recorded" | "corporate.payment.reconciled" | "corporate.payment.voided"
  | "corporate.custom_field.created" | "corporate.custom_field.updated"
  | "corporate.work_item.created" | "corporate.work_item.updated" | "corporate.work_item.resolved" | "corporate.work_item.escalated"
  | "corporate.reminder.sent" | "corporate.reminder.blocked" | "corporate.reminder.failed";

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const TOKEN_ALPHABET = /^[A-Za-z0-9_-]{40,}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const BANNED_KEYS = new Set(["email", "fullname", "name", "token", "password"]);

export function assertNoPii(meta: unknown): void {
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (EMAIL_PATTERN.test(value)) throw new Error(`Audit meta at "${path}" looks like an email address`);
      if (TOKEN_ALPHABET.test(value) && !HEX_DIGEST.test(value)) throw new Error(`Audit meta at "${path}" looks like a raw token`);
      return;
    }
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${path}[${index}]`)); return; }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (BANNED_KEYS.has(key.toLowerCase())) throw new Error(`Audit meta must not contain the key "${key}"`);
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(meta, "");
}

export async function audit(actor: string, action: AuditAction, subjectId?: string, meta?: Prisma.InputJsonObject, client: Prisma.TransactionClient | typeof db = db): Promise<void> {
  assertNoPii(meta);
  await client.auditEvent.create({ data: { actor, action, subjectId: subjectId ?? null, meta: meta ?? undefined } });
}

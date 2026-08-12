import type { AuditAction } from "@/lib/audit";

/** Human-readable audit labels for the Data & audit explorer. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "admin.login": "Signed in",
  "user.created": "Hiring user created",
  "user.role_changed": "Hiring user role changed",
  "user.password_reset": "Hiring user password reset",
  "user.password_changed": "Changed password",
  "user.removed": "Hiring user removed",
  "invite.created": "Invitation created",
  "invite.resent": "Invitation resent",
  "invite.revoked": "Invitation revoked",
  "candidate.consented": "Consent recorded",
  "assessment.submitted": "Assessment submitted",
  "result.viewed": "Profile viewed",
  "export.downloaded": "Results exported",
  "candidate.deleted": "Candidate deleted",
  "data.purged": "Candidate data purged",
  "assessment.seeded": "Assessment seeded",
  "assessment.created": "Assessment created",
  "assessment.duplicated": "Assessment duplicated",
  "assessment.published": "Assessment published",
  "assessment.archived": "Assessment archived",
  "draft.validated": "Draft validated",
  "round.created": "Hiring round created",
  "round.opened": "Hiring round opened",
  "round.closed": "Hiring round closed",
  "round.archived": "Hiring round archived",
  "corporate.counterparty.created": "Administrative counterparty created",
  "corporate.counterparty.updated": "Administrative counterparty updated",
  "corporate.counterparty.contact.created": "Counterparty contact created",
  "corporate.counterparty.contact.updated": "Counterparty contact updated",
  "corporate.site.created": "Administrative site created",
  "corporate.site.updated": "Administrative site updated",
  "corporate.site.coverage.created": "Site service coverage created",
  "corporate.site.coverage.updated": "Site service coverage updated",
  "corporate.obligation.created": "Administrative obligation created",
  "corporate.obligation.updated": "Administrative obligation updated",
  "corporate.obligation.activated": "Administrative obligation activated",
  "corporate.obligation.ended": "Administrative obligation ended",
  "corporate.obligation.cancelled": "Administrative obligation cancelled",
  "corporate.obligation.site.linked": "Obligation linked to site",
  "corporate.obligation.party.linked": "Counterparty role linked to obligation",
  "corporate.obligation.line.created": "Agreement line created",
  "corporate.obligation.line.updated": "Agreement line updated",
  "corporate.due_item.created": "Administrative due item created",
  "corporate.due_item.updated": "Administrative due item updated",
  "corporate.payment.requested": "Administrative payment requested",
  "corporate.payment.approved": "Administrative payment approved",
  "corporate.payment.rejected": "Administrative payment rejected",
  "corporate.payment.recorded": "Administrative payment recorded",
  "corporate.payment.reconciled": "Administrative payment reconciled",
  "corporate.payment.voided": "Administrative payment voided",
  "corporate.custom_field.created": "Administrative custom field created",
  "corporate.custom_field.updated": "Administrative custom field updated",
  "corporate.work_item.created": "Administrative work item created",
  "corporate.work_item.updated": "Administrative work item updated",
  "corporate.work_item.resolved": "Administrative work item resolved",
  "corporate.work_item.escalated": "Administrative work item escalated",
};

export const AUDIT_ACTION_OPTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

export type AuditDisplayRow = {
  id: string;
  action: string;
  actorId: string;
  actorName: string | null;
  subjectId: string | null;
  subjectExists: boolean;
  subjectLabel: string | null;
  createdAt: Date;
  meta: unknown;
};

export type AuditFilter = { action: string | null; from: Date | null; to: Date | null };

export function auditActionLabel(action: string): string { return AUDIT_ACTION_LABELS[action as AuditAction] ?? action; }
export function filterAuditRows(rows: AuditDisplayRow[], filter: AuditFilter): AuditDisplayRow[] {
  return rows.filter((row) => {
    if (filter.action && row.action !== filter.action) return false;
    if (filter.from && row.createdAt < filter.from) return false;
    if (filter.to && row.createdAt > filter.to) return false;
    return true;
  });
}
export function endOfLocalDay(date: Date): Date { const end = new Date(date); end.setHours(23, 59, 59, 999); return end; }
export function startOfLocalDay(date: Date): Date { const start = new Date(date); start.setHours(0, 0, 0, 0); return start; }
export function formatAuditMeta(meta: unknown): { key: string; value: string }[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const banned = new Set(["email", "fullname", "name", "token", "password"]);
  const pairs: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (banned.has(key.toLowerCase()) || value === null || value === undefined) continue;
    pairs.push({ key, value: typeof value === "object" ? JSON.stringify(value) : String(value) });
  }
  return pairs;
}

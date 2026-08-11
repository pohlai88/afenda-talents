import type { AuditAction } from "@/lib/audit";

/**
 * Human-readable audit labels and in-memory filtering for the Data & audit explorer.
 * Pure — no Prisma. Callers resolve actor/subject names from live tables (UI §11.2).
 */

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
};

export const AUDIT_ACTION_OPTIONS = Object.keys(
  AUDIT_ACTION_LABELS,
) as AuditAction[];

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

export type AuditFilter = {
  action: string | null;
  from: Date | null;
  to: Date | null;
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

export function filterAuditRows(
  rows: AuditDisplayRow[],
  filter: AuditFilter,
): AuditDisplayRow[] {
  return rows.filter((row) => {
    if (filter.action && row.action !== filter.action) return false;
    if (filter.from && row.createdAt < filter.from) return false;
    if (filter.to && row.createdAt > filter.to) return false;
    return true;
  });
}

export function endOfLocalDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function formatAuditMeta(
  meta: unknown,
): { key: string; value: string }[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];

  const banned = new Set(["email", "fullname", "name", "token", "password"]);
  const pairs: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(meta)) {
    if (banned.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      pairs.push({ key, value: JSON.stringify(value) });
      continue;
    }
    pairs.push({ key, value: String(value) });
  }

  return pairs;
}

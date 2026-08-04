import type { AuditAction } from "@/lib/audit";

/**
 * Human-readable audit labels and in-memory filtering for the Data & audit explorer.
 * Pure — no Prisma. Callers resolve actor/subject names from live tables (UI §11.2).
 */

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
	"admin.login": "Signed in",
	"user.password_changed": "Changed password",
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

/**
 * Inclusive date range on calendar days in local time.
 * `to` is end-of-day when it is a date-only boundary.
 */
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

/** End of local calendar day for a YYYY-MM-DD (or Date) input. */
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

/**
 * Flatten non-identifying meta for display. Skips banned keys defensively
 * even though `assertNoPii` already blocked them at write time.
 */
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

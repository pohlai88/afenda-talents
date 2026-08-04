/**
 * Pure invite list parsing and row classification (requirements §9.2D).
 * No Prisma — existing emails are passed in by the caller.
 */

export type InviteEntry = { fullName: string; email: string };

export type InviteRowStatus = "valid" | "invalid" | "duplicate" | "existing";

export type InviteRow = InviteEntry & {
	id: string;
	line: number;
	status: InviteRowStatus;
	reason: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Parse pasted "Name, email" lines. Empty lines are skipped.
 * Malformed lines still become rows so the review table can show why they failed.
 */
export function parseInviteLines(
	text: string,
): Omit<InviteRow, "status" | "reason">[] {
	const lines = text.split(/\r?\n/);
	const rows: Omit<InviteRow, "status" | "reason">[] = [];

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i]?.trim() ?? "";
		if (!raw) continue;

		const comma = raw.indexOf(",");
		let fullName = "";
		let email = "";
		if (comma === -1) {
			fullName = raw;
			email = "";
		} else {
			fullName = raw.slice(0, comma).trim();
			email = raw.slice(comma + 1).trim();
		}

		rows.push({
			id: `line-${i + 1}-${rows.length}`,
			line: i + 1,
			fullName,
			email,
		});
	}

	return rows;
}

/**
 * Classify rows: invalid shape, duplicate within the batch, already in the round, or valid.
 * First occurrence of an email wins as valid; later ones are duplicate.
 */
export function classifyInviteRows(
	rows: Omit<InviteRow, "status" | "reason">[],
	existingEmails: ReadonlySet<string> | readonly string[],
): InviteRow[] {
	const existing =
		existingEmails instanceof Set
			? existingEmails
			: new Set([...existingEmails].map(normalizeEmail));

	const seen = new Set<string>();

	return rows.map((row) => {
		const name = row.fullName.trim();
		const email = normalizeEmail(row.email);

		if (!name || name.length > 120) {
			return {
				...row,
				fullName: name,
				email: row.email.trim(),
				status: "invalid" as const,
				reason: !name ? "Name is missing" : "Name is too long",
			};
		}

		if (!email || !EMAIL_RE.test(email)) {
			return {
				...row,
				fullName: name,
				email: row.email.trim(),
				status: "invalid" as const,
				reason: "Email is missing or invalid",
			};
		}

		if (existing.has(email)) {
			return {
				...row,
				fullName: name,
				email,
				status: "existing" as const,
				reason: "Already invited in this round",
			};
		}

		if (seen.has(email)) {
			return {
				...row,
				fullName: name,
				email,
				status: "duplicate" as const,
				reason: "Duplicate in this list",
			};
		}

		seen.add(email);
		return {
			...row,
			fullName: name,
			email,
			status: "valid" as const,
			reason: null,
		};
	});
}

export function inviteRowCounts(rows: InviteRow[]): {
	valid: number;
	invalid: number;
	duplicate: number;
	existing: number;
} {
	return rows.reduce(
		(acc, row) => {
			acc[row.status] += 1;
			return acc;
		},
		{ valid: 0, invalid: 0, duplicate: 0, existing: 0 },
	);
}

export function validInviteEntries(rows: InviteRow[]): InviteEntry[] {
	return rows
		.filter((row) => row.status === "valid")
		.map((row) => ({ fullName: row.fullName, email: row.email }));
}

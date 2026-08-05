/**
 * Assignment and hiring-round status constants and pure transition rules.
 * Safe to import from client components — no database or server APIs.
 */
export const STATUSES = [
	"DRAFT",
	"SENT",
	"STARTED",
	"SUBMITTED",
	"SCORED",
	"EXPIRED",
	"REVOKED",
] as const;

export type Status = (typeof STATUSES)[number];

const LEGAL: Record<Status, readonly Status[]> = {
	DRAFT: ["SENT"],
	SENT: ["STARTED", "EXPIRED", "REVOKED"],
	STARTED: ["SUBMITTED", "EXPIRED", "REVOKED"],
	SUBMITTED: ["SCORED"],
	SCORED: [],
	EXPIRED: ["SENT"],
	REVOKED: ["SENT"],
};

export class IllegalStatusTransition extends Error {
	constructor(from: Status, to: Status) {
		super(`Illegal status transition: ${from} -> ${to}`);
		this.name = "IllegalStatusTransition";
	}
}

export function canTransition(from: Status, to: Status): boolean {
	return LEGAL[from]?.includes(to) ?? false;
}

export function assertTransition(from: Status, to: Status): void {
	if (!canTransition(from, to)) throw new IllegalStatusTransition(from, to);
}

/** Optional timestamp fields written alongside a status transition. */
export type StatusTransitionExtra = Partial<{
	sentAt: Date;
	submittedAt: Date;
	consentedAt: Date;
	startedAt: Date;
	openedAt: Date;
}>;

export const ROUND_STATUSES = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

const ROUND_LEGAL: Record<RoundStatus, readonly RoundStatus[]> = {
	DRAFT: ["OPEN", "ARCHIVED"],
	OPEN: ["CLOSED"],
	CLOSED: ["ARCHIVED"],
	ARCHIVED: [],
};

export class IllegalRoundTransition extends Error {
	constructor(from: RoundStatus, to: RoundStatus) {
		super(`Illegal round transition: ${from} -> ${to}`);
		this.name = "IllegalRoundTransition";
	}
}

export function assertRoundTransition(from: RoundStatus, to: RoundStatus): void {
	if (!ROUND_LEGAL[from]?.includes(to)) {
		throw new IllegalRoundTransition(from, to);
	}
}

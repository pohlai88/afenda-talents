import { db } from "@/lib/db";

/**
 * Assignment status machine (D18). ONLY writer of CandidateAssignment.status.
 * Spec §3; build-skill invariant 3.
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

/**
 * Applies a transition on CandidateAssignment after checking the table.
 */
export async function applyStatus(
	assignmentId: string,
	to: Status,
	extra: Record<string, unknown> = {},
): Promise<void> {
	const assignment = await db.candidateAssignment.findUnique({
		where: { id: assignmentId },
		select: { status: true },
	});
	if (!assignment) throw new Error(`Assignment not found: ${assignmentId}`);

	assertTransition(assignment.status as Status, to);

	await db.candidateAssignment.update({
		where: { id: assignmentId },
		data: { status: to, ...extra },
	});
}

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

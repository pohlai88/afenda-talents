import { db } from "@/lib/db";
import {
	assertTransition,
	type Status,
	type StatusTransitionExtra,
} from "@/lib/status-constants";

/**
 * Assignment status machine (D18). ONLY writer of CandidateAssignment.status.
 * Spec §3; build-skill invariant 3.
 *
 * Server-only — imports Prisma. Client code must use status-constants.ts.
 */
export async function applyStatus(
	assignmentId: string,
	to: Status,
	extra: StatusTransitionExtra = {},
): Promise<void> {
	const assignment = await db.candidateAssignment.findUnique({
		where: { id: assignmentId },
		select: { status: true },
	});
	if (!assignment) throw new Error(`Assignment not found: ${assignmentId}`);

	assertTransition(assignment.status, to);

	await db.candidateAssignment.update({
		where: { id: assignmentId },
		data: { status: to, ...extra },
	});
}

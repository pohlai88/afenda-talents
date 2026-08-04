import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { CandidateAssignment } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { allowsAnswerWrites } from "@/lib/assignment-gates";
import { hashToken } from "@/lib/tokens";

/**
 * CANDIDATE authentication only (assignment-scoped, D18).
 * Cookie name stays afenda_candidate; JWT claim is assignmentId.
 * Never import auth-admin. Build-skill invariant 7.
 */
export const CANDIDATE_COOKIE = "afenda_candidate";

const secret = () => new TextEncoder().encode(env.APP_SECRET);

/** Token entry + consent: invitation still open. */
const OPEN_STATUSES = new Set(["SENT", "STARTED"]);

export type AssignmentWithCandidate = CandidateAssignment & {
	candidate: { id: string; email: string; fullName: string };
};

export function candidateCookieOptions(maxAge: number) {
	return {
		httpOnly: true,
		secure: env.APP_URL.startsWith("https"),
		sameSite: "lax" as const,
		path: "/",
		maxAge,
	};
}

/**
 * Resolves a raw path token to an assignment, or null.
 * Null covers: unknown token, expired invitation, revoked, and already finished.
 */
export async function resolveAssignmentToken(
	token: string,
): Promise<AssignmentWithCandidate | null> {
	const assignment = await db.candidateAssignment.findUnique({
		where: { tokenHash: hashToken(token) },
		include: { candidate: { select: { id: true, email: true, fullName: true } } },
	});
	if (!assignment) return null;
	if (assignment.expiresAt && assignment.expiresAt.getTime() < Date.now()) return null;
	if (!OPEN_STATUSES.has(assignment.status)) return null;
	return assignment;
}

export async function createAssignmentSession(assignmentId: string): Promise<string> {
	return new SignJWT({ assignmentId })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("4h")
		.sign(secret());
}

export async function currentAssignmentId(): Promise<string | null> {
	const value = (await cookies()).get(CANDIDATE_COOKIE)?.value;
	if (!value) return null;
	try {
		const { payload } = await jwtVerify(value, secret());
		return typeof payload.assignmentId === "string" ? payload.assignmentId : null;
	} catch {
		return null;
	}
}

async function loadOpenAssignment(id: string): Promise<AssignmentWithCandidate> {
	const assignment = await db.candidateAssignment.findUnique({
		where: { id },
		include: { candidate: { select: { id: true, email: true, fullName: true } } },
	});
	if (!assignment) throw new Error("Assignment not found");
	if (!OPEN_STATUSES.has(assignment.status)) throw new Error("Assessment is closed");
	if (assignment.expiresAt && assignment.expiresAt.getTime() < Date.now()) {
		throw new Error("Invitation expired");
	}
	return assignment;
}

/**
 * Consent handler: SENT or STARTED (idempotent re-start).
 * Re-reads the assignment row (D7).
 */
export async function requireAssignment(): Promise<AssignmentWithCandidate> {
	const id = await currentAssignmentId();
	if (!id) throw new Error("No assignment session");
	return loadOpenAssignment(id);
}

/**
 * Autosave + submit: consent must already have moved status to STARTED (spec §13.7).
 */
export async function requireStartedAssignment(): Promise<AssignmentWithCandidate> {
	const assignment = await requireAssignment();
	if (!allowsAnswerWrites(assignment.status)) {
		throw new Error("Consent required");
	}
	return assignment;
}

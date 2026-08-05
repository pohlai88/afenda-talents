import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
	CANDIDATE_COOKIE,
	candidateCookieOptions,
	createAssignmentSession,
	resolveAssignmentToken,
} from "@/lib/auth-candidate";

export const runtime = "nodejs";

/**
 * Candidate entry point. Cookie claim is assignmentId (D18).
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ token: string }> },
) {
	const { token } = await params;
	const base = env.APP_URL;

	const t0 = performance.now();
	const assignment = await resolveAssignmentToken(token);
	const dbMs = performance.now() - t0;
	const timing = `db;dur=${dbMs.toFixed(1)}`;

	if (!assignment) {
		return new Response(null, {
			status: 307,
			headers: {
				Location: new URL(`/a/${token}/done`, base).toString(),
				"Server-Timing": timing,
				"x-afenda-db-ms": dbMs.toFixed(1),
			},
		});
	}

	if (!assignment.openedAt) {
		await db.candidateAssignment.update({
			where: { id: assignment.id },
			data: { openedAt: new Date() },
		});
	}

	const destination = assignment.status === "STARTED" ? "assessment" : "consent";
	const response = NextResponse.redirect(new URL(`/a/${token}/${destination}`, base));
	response.headers.set("Server-Timing", timing);
	response.headers.set("x-afenda-db-ms", dbMs.toFixed(1));
	response.cookies.set(
		CANDIDATE_COOKIE,
		await createAssignmentSession(assignment.id),
		candidateCookieOptions(4 * 60 * 60),
	);
	return response;
}

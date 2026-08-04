import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
	CANDIDATE_COOKIE,
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

	const assignment = await resolveAssignmentToken(token);
	if (!assignment) {
		return NextResponse.redirect(new URL(`/a/${token}/done`, base));
	}

	if (!assignment.openedAt) {
		await db.candidateAssignment.update({
			where: { id: assignment.id },
			data: { openedAt: new Date() },
		});
	}

	const destination = assignment.status === "STARTED" ? "assessment" : "consent";
	const response = NextResponse.redirect(new URL(`/a/${token}/${destination}`, base));
	response.cookies.set(CANDIDATE_COOKIE, await createAssignmentSession(assignment.id), {
		httpOnly: true,
		secure: env.APP_URL.startsWith("https"),
		sameSite: "lax",
		path: "/",
		maxAge: 4 * 60 * 60,
	});
	return response;
}

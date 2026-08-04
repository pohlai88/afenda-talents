import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CANDIDATE_COOKIE, requireAssignment } from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";
import { scoreAssessment } from "@/lib/scoring";
import { sendReceipt } from "@/lib/email";
import { loadVersionDocument } from "@/lib/version-document";
import { orderedAnswerableItems } from "@/lib/instrument-document";

export const runtime = "nodejs";

export async function POST() {
	let assignment;
	try {
		assignment = await requireAssignment();
	} catch {
		return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
	}

	const doc = await loadVersionDocument(assignment.assessmentVersionId);
	const answerable = orderedAnswerableItems(doc).filter((i) => i.type === "likert");

	const responses = await db.response.findMany({
		where: { assignmentId: assignment.id },
	});

	const answeredIds = new Set(responses.map((r) => r.questionId ?? r.itemId));
	const unanswered = answerable.filter((i) => !answeredIds.has(i.id)).map((i) => i.id);
	if (unanswered.length > 0) {
		return NextResponse.json(
			{ error: "Please answer every statement before submitting.", unanswered },
			{ status: 400 },
		);
	}

	const scored = scoreAssessment({
		versionDocument: doc,
		responses: responses.map((r) => ({
			itemId: r.questionId ?? r.itemId,
			value: r.value,
			msOnItem: r.msOnItem,
		})),
	});

	const stamps = responses.map((r) => r.updatedAt.getTime());
	const serverWindowSeconds = Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000);

	await applyStatus(assignment.id, "SUBMITTED", { submittedAt: new Date() });

	await db.result.upsert({
		where: { assignmentId: assignment.id },
		update: {
			dimensionScores: scored.dimensions,
			validityFlags: scored.responseContext,
			totalSeconds: scored.totalSeconds,
			serverWindowSeconds,
			assessmentVersionId: assignment.assessmentVersionId,
		},
		create: {
			candidateId: assignment.candidateId,
			assignmentId: assignment.id,
			assessmentVersionId: assignment.assessmentVersionId,
			dimensionScores: scored.dimensions,
			validityFlags: scored.responseContext,
			totalSeconds: scored.totalSeconds,
			serverWindowSeconds,
		},
	});

	await applyStatus(assignment.id, "SCORED");
	await audit("candidate", "assessment.submitted", assignment.id, {
		itemCount: answerable.length,
		totalSeconds: scored.totalSeconds,
		versionId: assignment.assessmentVersionId,
	});

	await sendReceipt(assignment.candidate.email, assignment.candidate.fullName);

	const response = NextResponse.json({ ok: true });
	response.cookies.set(CANDIDATE_COOKIE, "", { path: "/", maxAge: 0 });
	return response;
}

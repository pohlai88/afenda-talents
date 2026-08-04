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
	const answerable = orderedAnswerableItems(doc);

	const responses = await db.response.findMany({
		where: { assignmentId: assignment.id },
	});
	const byQuestion = new Map(responses.map((r) => [r.questionId, r]));

	const unanswered: string[] = [];
	for (const item of answerable) {
		const row = byQuestion.get(item.id);
		if (item.type === "likert") {
			if (!row || row.value == null) unanswered.push(item.id);
		} else if (item.type === "short_text" || item.type === "long_text") {
			if (item.required && (!row || !row.textValue?.trim())) unanswered.push(item.id);
		}
	}
	if (unanswered.length > 0) {
		return NextResponse.json(
			{ error: "Please answer every required item before submitting.", unanswered },
			{ status: 400 },
		);
	}

	const likertResponses = answerable
		.filter((i) => i.type === "likert")
		.map((i) => {
			const r = byQuestion.get(i.id)!;
			return { itemId: i.id, value: r.value!, msOnItem: r.msOnItem };
		});

	const scored = scoreAssessment({
		versionDocument: doc,
		responses: likertResponses,
	});

	const stamps = responses.map((r) => r.updatedAt.getTime());
	const serverWindowSeconds =
		stamps.length > 0
			? Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000)
			: 0;

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

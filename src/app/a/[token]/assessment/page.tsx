import { redirect } from "next/navigation";
import { currentAssignmentId, resolveAssignmentToken } from "@/lib/auth-candidate";
import {
	AssessmentForm,
	type AssessmentFormItem,
} from "@/components/assessment-form";
import { loadVersionDocument } from "@/lib/version-document";
import { orderedAnswerableItems } from "@/lib/instrument-document";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;

	const assignment = await resolveAssignmentToken(token);
	if (!assignment) redirect(`/a/${token}/done`);

	const cookieAssignmentId = await currentAssignmentId();
	if (cookieAssignmentId !== assignment.id) redirect(`/a/${token}/done`);

	if (assignment.status !== "STARTED") redirect(`/a/${token}`);

	const doc = await loadVersionDocument(assignment.assessmentVersionId);
	const answerable = orderedAnswerableItems(doc);

	const formItems: AssessmentFormItem[] = [];
	let order = 0;
	for (const item of answerable) {
		order += 1;
		if (item.type === "likert") {
			formItems.push({
				id: item.id,
				order,
				text: item.text,
				type: "likert",
				required: item.required,
			});
		} else if (item.type === "short_text" || item.type === "long_text") {
			formItems.push({
				id: item.id,
				order,
				text: item.text,
				type: item.type,
				required: item.required,
				maxLength: item.maxLength,
				helperText: item.helperText,
			});
		}
	}

	const responses = await db.response.findMany({
		where: { assignmentId: assignment.id },
	});
	const saved: Record<string, { value?: number; textValue?: string }> = {};
	for (const r of responses) {
		saved[r.questionId] = {
			value: r.value ?? undefined,
			textValue: r.textValue ?? undefined,
		};
	}

	return <AssessmentForm token={token} items={formItems} saved={saved} />;
}

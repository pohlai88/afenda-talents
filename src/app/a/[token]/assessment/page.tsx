import { redirect } from "next/navigation";
import { currentAssignmentId, resolveAssignmentToken } from "@/lib/auth-candidate";
import { AssessmentForm } from "@/components/assessment-form";
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
	const items = orderedAnswerableItems(doc).filter((i) => i.type === "likert");

	const responses = await db.response.findMany({
		where: { assignmentId: assignment.id },
	});
	const saved = Object.fromEntries(
		responses.map((r) => [r.questionId ?? r.itemId, r.value]),
	);

	return (
		<AssessmentForm
			token={token}
			items={items.map((i, order) => ({
				id: i.id,
				order: order + 1,
				text: i.text,
			}))}
			saved={saved}
		/>
	);
}

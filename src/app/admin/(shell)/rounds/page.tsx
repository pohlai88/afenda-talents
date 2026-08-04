import { RoundManager, type RoundRow, type VersionOption } from "@/components/rounds/round-manager";
import { PageHeader } from "@/components/page-header";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Thin hiring rounds (D18 §4): a round only names, statuses, and assigns a published
 * assessment version. Admins create and move rounds through their lifecycle; viewers
 * read the same list. Invites still require an OPEN round — see /admin/invite.
 */
export default async function RoundsPage() {
	const session = await requireHiringUser();
	const isAdmin = session.role === "ADMIN";

	const [rounds, versions] = await Promise.all([
		db.hiringRound.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				assessmentVersion: {
					include: { assessment: { select: { id: true, title: true, kind: true } } },
				},
				_count: { select: { assignments: true } },
			},
		}),
		db.assessmentVersion.findMany({
			include: { assessment: { select: { id: true, title: true, kind: true } } },
		}),
	]);

	const rows: RoundRow[] = rounds.map((round) => ({
		id: round.id,
		name: round.name,
		status: round.status,
		assessmentVersionId: round.assessmentVersionId,
		assessmentTitle: round.assessmentVersion.assessment.title,
		versionNumber: round.assessmentVersion.versionNumber,
		assignmentCount: round._count.assignments,
	}));

	const versionOptions: VersionOption[] = versions
		.map((version) => ({
			id: version.id,
			assessmentTitle: version.assessment.title,
			assessmentKind: version.assessment.kind,
			versionNumber: version.versionNumber,
		}))
		.sort(
			(a, b) =>
				a.assessmentTitle.localeCompare(b.assessmentTitle) || b.versionNumber - a.versionNumber,
		);

	return (
		<div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6 overflow-x-hidden p-6">
			<PageHeader
				eyebrow="Workspace"
				title="Hiring rounds"
				description="Each round assigns one published assessment version. Opening a round locks that version; invitations require an open round."
			/>
			<RoundManager rounds={rows} versionOptions={versionOptions} isAdmin={isAdmin} />
		</div>
	);
}

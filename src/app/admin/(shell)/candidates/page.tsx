import { Suspense } from "react";
import Link from "next/link";
import {
	CandidatesDatatable,
	type CandidateTableItem,
} from "@/components/candidates/candidates-datatable";
import { NoCandidates } from "@/components/candidates/empty-states";
import { relativeTime } from "@/components/overview/round-summary";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
	const session = await requireHiringUser();
	const isAdmin = session.role === "ADMIN";
	const now = new Date();

	// One row per assignment (D18): the same person may hold more than one assignment
	// across hiring rounds, and status chips must reflect the assignment, not a
	// legacy candidate-level status.
	const [assignments, responseActivity, users] = await Promise.all([
		db.candidateAssignment.findMany({
			include: { candidate: true },
			orderBy: { createdAt: "asc" },
		}),
		db.response.groupBy({ by: ["assignmentId"], _max: { updatedAt: true } }),
		db.user.findMany({ select: { id: true, name: true } }),
	]);

	const lastResponseAt = new Map(
		responseActivity.map((r) => [r.assignmentId, r._max.updatedAt]),
	);
	const userNames = new Map(users.map((u) => [u.id, u.name]));

	const items: CandidateTableItem[] = assignments.map((a) => {
		const lastActivityAt =
			[lastResponseAt.get(a.id) ?? null, a.submittedAt, a.openedAt, a.sentAt]
				.filter((d): d is Date => d instanceof Date)
				.sort((a2, b2) => b2.getTime() - a2.getTime())[0] ?? null;

		return {
			id: a.candidateId,
			assignmentId: a.id,
			fullName: a.candidate.fullName,
			email: a.candidate.email,
			status: a.status,
			sentAt: a.sentAt?.toISOString() ?? null,
			submittedAt: a.submittedAt?.toISOString() ?? null,
			lastActivityAt: lastActivityAt?.toISOString() ?? null,
			lastActivityLabel: lastActivityAt
				? relativeTime(lastActivityAt, now)
				: "—",
			invitedByName: a.invitedById
				? (userNames.get(a.invitedById) ?? null)
				: null,
		};
	});

	return (
		<div className="flex min-w-0 max-w-full flex-col gap-6 overflow-x-hidden p-6">
			<PageHeader
				eyebrow="This hiring round"
				title="Candidates"
				description="Find a candidate, check where they are, and act on their invitation."
				actions={
					isAdmin ? (
						<>
							<Button
								variant="outline"
								nativeButton={false}
								render={<a href="/api/admin/export" />}
							>
								Export CSV
							</Button>
							<Button
								nativeButton={false}
								render={<Link href="/admin/invite" />}
							>
								Invite candidates
							</Button>
						</>
					) : null
				}
			/>

			{assignments.length === 0 ? (
				<NoCandidates isAdmin={isAdmin} />
			) : (
				<Suspense
					fallback={
						<p className="text-sm text-muted-foreground">Loading candidates…</p>
					}
				>
					<CandidatesDatatable data={items} isAdmin={isAdmin} />
				</Suspense>
			)}
		</div>
	);
}

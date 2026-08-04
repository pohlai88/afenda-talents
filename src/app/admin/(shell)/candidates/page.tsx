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

	const [candidates, responseActivity, users] = await Promise.all([
		db.candidate.findMany({ orderBy: { createdAt: "asc" } }),
		db.response.groupBy({ by: ["candidateId"], _max: { updatedAt: true } }),
		db.user.findMany({ select: { id: true, name: true } }),
	]);

	const lastResponseAt = new Map(
		responseActivity.map((r) => [r.candidateId, r._max.updatedAt]),
	);
	const userNames = new Map(users.map((u) => [u.id, u.name]));

	const items: CandidateTableItem[] = candidates.map((c) => {
		const lastActivityAt =
			[lastResponseAt.get(c.id) ?? null, c.submittedAt, c.openedAt, c.sentAt]
				.filter((d): d is Date => d instanceof Date)
				.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

		return {
			id: c.id,
			fullName: c.fullName,
			email: c.email,
			status: c.status,
			sentAt: c.sentAt?.toISOString() ?? null,
			submittedAt: c.submittedAt?.toISOString() ?? null,
			lastActivityAt: lastActivityAt?.toISOString() ?? null,
			lastActivityLabel: lastActivityAt
				? relativeTime(lastActivityAt, now)
				: "—",
			invitedByName: c.invitedById
				? (userNames.get(c.invitedById) ?? null)
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

			{candidates.length === 0 ? (
				<NoCandidates isAdmin={isAdmin} />
			) : (
				<CandidatesDatatable data={items} isAdmin={isAdmin} />
			)}
		</div>
	);
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import type { Status } from "@/lib/status-constants";
import { EXCEPTION_STAGES } from "@/lib/status-display";
import { hiringAttention, workspaceAttention, type CandidateFacts } from "@/lib/attention";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";
import { normalizeContextFlags, normalizeDimensions } from "@/lib/result-display";
import { Button } from "@/components/ui/button";
import { RoundSummary } from "@/components/overview/round-summary";
import { WorkflowStrip } from "@/components/overview/workflow-strip";
import { HiringAttention, WorkspaceAttention } from "@/components/overview/attention-list";
import { RecentCompletions, type CompletedProfile } from "@/components/overview/recent-completions";
import { ActivityFeed, type ActivityEntry } from "@/components/overview/activity-feed";
import {
	EmptyRound,
	EmptyRoundAdminActions,
} from "@/components/overview/empty-round";

export const dynamic = "force-dynamic";

/**
 * Operational overview (D17 + D18): derived from CandidateAssignment rows.
 */
export default async function AdminOverviewPage() {
	const session = await requireHiringUser();
	const isAdmin = session.role === "ADMIN";
	const now = new Date();

	const [assignments, responseActivity, viewEvents, feedEvents, users] = await Promise.all([
		db.candidateAssignment.findMany({
			include: {
				candidate: { select: { id: true, fullName: true } },
				result: true,
			},
			orderBy: { createdAt: "asc" },
		}),
		db.response.groupBy({
			by: ["assignmentId"],
			_max: { updatedAt: true },
		}),
		db.auditEvent.findMany({
			where: { action: "result.viewed" },
			select: { subjectId: true, createdAt: true },
			orderBy: { createdAt: "desc" },
		}),
		db.auditEvent.findMany({
			where: { action: { in: [...FEED_ACTIONS] } },
			orderBy: { createdAt: "desc" },
			take: 8,
		}),
		db.user.findMany({ select: { id: true, name: true, mustChangePassword: true } }),
	]);

	const me = users.find((u) => u.id === session.userId);
	const firstName = (me?.name ?? "there").split(" ")[0];

	const lastResponseAt = new Map(
		responseActivity
			.filter((r): r is typeof r & { assignmentId: string } => Boolean(r.assignmentId))
			.map((r) => [r.assignmentId, r._max.updatedAt]),
	);
	const lastViewedAt = new Map<string, Date>();
	for (const event of viewEvents) {
		if (event.subjectId && !lastViewedAt.has(event.subjectId)) {
			lastViewedAt.set(event.subjectId, event.createdAt);
		}
	}

	const facts: CandidateFacts[] = assignments.map((a) => ({
		id: a.id,
		fullName: a.candidate.fullName,
		status: a.status,
		sentAt: a.sentAt,
		openedAt: a.openedAt,
		startedAt: a.startedAt,
		expiresAt: a.expiresAt,
		lastResponseAt: lastResponseAt.get(a.id) ?? null,
		computedAt: a.result?.computedAt ?? null,
		lastViewedAt: lastViewedAt.get(a.id) ?? null,
	}));

	const attention = hiringAttention(facts, now);
	const workspace = workspaceAttention(users);

	const counts: Partial<Record<Status, number>> = {};
	for (const a of assignments) {
		counts[a.status] = (counts[a.status] ?? 0) + 1;
	}
	const exceptions = EXCEPTION_STAGES.map((status) => ({
		status,
		count: counts[status] ?? 0,
	}));

	const completed: CompletedProfile[] = assignments
		.filter((a) => a.status === "SCORED" && a.result)
		.sort(
			(a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
		)
		.slice(0, 4)
		.map((a) => {
			const result = a.result!;
			return {
				id: a.id,
				fullName: a.candidate.fullName,
				submittedAt: a.submittedAt,
				dimensions: normalizeDimensions(result.dimensionScores),
				contextCount: normalizeContextFlags(result.validityFlags).filter(
					(f) => f.triggered,
				).length,
			};
		});

	const userNames = new Map(users.map((u) => [u.id, u.name]));
	const subjectNames = new Map<string, string>();
	for (const a of assignments) {
		subjectNames.set(a.id, a.candidate.fullName);
		subjectNames.set(a.candidate.id, a.candidate.fullName);
	}
	const entries: ActivityEntry[] = feedEvents
		.map((event) => {
			const sentence = activitySentence({
				action: event.action,
				actorName: userNames.get(event.actor) ?? null,
				subjectName: event.subjectId
					? (subjectNames.get(event.subjectId) ?? null)
					: null,
			});
			return sentence ? { id: event.id, sentence, at: event.createdAt } : null;
		})
		.filter((entry): entry is ActivityEntry => entry !== null);

	const lastActivityAt = feedEvents[0]?.createdAt ?? null;

	return (
		<div className="flex min-w-0 flex-col gap-6 overflow-x-hidden p-6">
			<RoundSummary
				firstName={firstName}
				total={assignments.length}
				ready={counts.SCORED ?? 0}
				needsAttention={attention.length}
				lastActivityAt={lastActivityAt}
				now={now}
			>
				{isAdmin ? (
					<>
						<Button
							variant="outline"
							nativeButton={false}
							render={<a href="/api/admin/export" />}
						>
							Export results
						</Button>
						<Button nativeButton={false} render={<Link href="/admin/invite" />}>
							Invite candidates
						</Button>
					</>
				) : null}
			</RoundSummary>

			{assignments.length === 0 ? (
				<EmptyRound>{isAdmin ? <EmptyRoundAdminActions /> : null}</EmptyRound>
			) : (
				<>
					<section aria-labelledby="workflow-heading">
						<WorkflowStrip counts={counts} exceptions={exceptions} />
					</section>
					<div className="grid gap-6 lg:grid-cols-2">
						<section aria-labelledby="attention-heading">
							<HiringAttention items={attention} now={now} />
						</section>
						<section aria-labelledby="activity-heading">
							<ActivityFeed entries={entries} now={now} />
						</section>
					</div>
					<section aria-labelledby="completions-heading">
						<RecentCompletions profiles={completed} />
					</section>
					{workspace.length > 0 && (
						<section aria-labelledby="workspace-heading">
							<WorkspaceAttention items={workspace} />
						</section>
					)}
				</>
			)}
		</div>
	);
}

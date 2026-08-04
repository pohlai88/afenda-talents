import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { EXCEPTION_STAGES } from "@/lib/status-display";
import { hiringAttention, workspaceAttention, type CandidateFacts } from "@/lib/attention";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";
import { normalizeContextFlags, normalizeDimensions } from "@/lib/result-display";
import { RoundSummary } from "@/components/overview/round-summary";
import { WorkflowStrip } from "@/components/overview/workflow-strip";
import { HiringAttention, WorkspaceAttention } from "@/components/overview/attention-list";
import { RecentCompletions, type CompletedProfile } from "@/components/overview/recent-completions";
import { ActivityFeed, type ActivityEntry } from "@/components/overview/activity-feed";
import { EmptyRound } from "@/components/overview/empty-round";

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
			where: { assignmentId: { not: null } },
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
			.filter((r) => r.assignmentId)
			.map((r) => [r.assignmentId!, r._max.updatedAt]),
	);
	const lastViewedAt = new Map<string, Date>();
	for (const event of viewEvents) {
		if (event.subjectId && !lastViewedAt.has(event.subjectId)) {
			lastViewedAt.set(event.subjectId, event.createdAt);
		}
	}

	const facts: CandidateFacts[] = assignments.map((a) => ({
		id: a.candidate.id,
		fullName: a.candidate.fullName,
		status: a.status,
		sentAt: a.sentAt,
		openedAt: a.openedAt,
		startedAt: a.startedAt,
		expiresAt: a.expiresAt,
		lastResponseAt: lastResponseAt.get(a.id) ?? null,
		computedAt: a.result?.computedAt ?? null,
		lastViewedAt: lastViewedAt.get(a.id) ?? lastViewedAt.get(a.candidate.id) ?? null,
	}));

	const attention = hiringAttention(facts, now);
	const workspace = workspaceAttention(users);

	const counts: Record<string, number> = {};
	for (const a of assignments) counts[a.status] = (counts[a.status] ?? 0) + 1;
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
				id: a.candidate.id,
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
		<div className="flex flex-col gap-6 p-6">
			<RoundSummary
				firstName={firstName}
				total={assignments.length}
				ready={counts.SCORED ?? 0}
				needsAttention={attention.length}
				lastActivityAt={lastActivityAt}
				now={now}
				isAdmin={isAdmin}
			/>

			{assignments.length === 0 ? (
				<EmptyRound isAdmin={isAdmin} />
			) : (
				<>
					<WorkflowStrip counts={counts} exceptions={exceptions} />
					<div className="grid gap-6 lg:grid-cols-2">
						<HiringAttention items={attention} now={now} />
						<ActivityFeed entries={entries} now={now} />
					</div>
					<RecentCompletions profiles={completed} />
					<WorkspaceAttention items={workspace} />
				</>
			)}
		</div>
	);
}

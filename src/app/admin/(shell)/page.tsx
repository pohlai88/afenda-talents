import Link from "next/link";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import type { Status } from "@/lib/status-constants";
import { EXCEPTION_STAGES } from "@/lib/status-display";
import {
  hiringAttention,
  workspaceAttention,
  type CandidateFacts,
} from "@/lib/attention";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";
import {
  normalizeContextFlags,
  normalizeDimensions,
} from "@/lib/result-display";
import {
  resolveOperationalRound,
  withRound,
} from "@/lib/round-context";
import { Button } from "@/components/ui/button";
import { RoundSummary } from "@/components/overview/round-summary";
import { WorkflowStrip } from "@/components/overview/workflow-strip";
import {
  HiringAttention,
  WorkspaceAttention,
} from "@/components/overview/attention-list";
import {
  RecentCompletions,
  type CompletedProfile,
} from "@/components/overview/recent-completions";
import {
  ActivityFeed,
  type ActivityEntry,
} from "@/components/overview/activity-feed";
import {
  EmptyRound,
  EmptyRoundAdminActions,
} from "@/components/overview/empty-round";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  round?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const params = await searchParams;
  const { selected } = await resolveOperationalRound(first(params.round));
  const now = new Date();

  const [assignments, users] = await Promise.all([
    selected
      ? db.candidateAssignment.findMany({
          where: { hiringRoundId: selected.id },
          include: {
            candidate: { select: { id: true, fullName: true } },
            result: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    db.user.findMany({
      select: { id: true, name: true, mustChangePassword: true },
    }),
  ]);

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const candidateIds = assignments.map((assignment) => assignment.candidate.id);
  const roundSubjectIds = new Set([...assignmentIds, ...candidateIds]);
  const [responseActivity, viewEvents, candidateFeedEvents, exportFeedEvents] =
    await Promise.all([
      assignmentIds.length > 0
        ? db.response.groupBy({
            by: ["assignmentId"],
            where: { assignmentId: { in: assignmentIds } },
            _max: { updatedAt: true },
          })
        : Promise.resolve([]),
      assignmentIds.length > 0
        ? db.auditEvent.findMany({
            where: {
              action: "result.viewed",
              subjectId: { in: assignmentIds },
            },
            select: { subjectId: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      roundSubjectIds.size > 0
        ? db.auditEvent.findMany({
            where: {
              action: { in: [...FEED_ACTIONS] },
              subjectId: { in: [...roundSubjectIds] },
            },
            orderBy: { createdAt: "desc" },
            take: 24,
          })
        : Promise.resolve([]),
      selected
        ? db.auditEvent.findMany({
            where: {
              action: "export.downloaded",
              meta: { path: ["roundId"], equals: selected.id },
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

  const feedEvents = [...candidateFeedEvents, ...exportFeedEvents]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8);
  const me = users.find((user) => user.id === session.userId);
  const firstName = (me?.name ?? "there").split(" ")[0];

  const lastResponseAt = new Map(
    responseActivity.map((row) => [row.assignmentId, row._max.updatedAt]),
  );
  const lastViewedAt = new Map<string, Date>();
  for (const event of viewEvents) {
    if (event.subjectId && !lastViewedAt.has(event.subjectId)) {
      lastViewedAt.set(event.subjectId, event.createdAt);
    }
  }

  const facts: CandidateFacts[] = assignments.map((assignment) => ({
    id: assignment.id,
    fullName: assignment.candidate.fullName,
    status: assignment.status,
    sentAt: assignment.sentAt,
    openedAt: assignment.openedAt,
    startedAt: assignment.startedAt,
    expiresAt: assignment.expiresAt,
    lastResponseAt: lastResponseAt.get(assignment.id) ?? null,
    computedAt: assignment.result?.computedAt ?? null,
    lastViewedAt: lastViewedAt.get(assignment.id) ?? null,
  }));

  const attention = hiringAttention(facts, now);
  const workspace = workspaceAttention(users);
  const counts: Partial<Record<Status, number>> = {};
  for (const assignment of assignments) {
    counts[assignment.status] = (counts[assignment.status] ?? 0) + 1;
  }
  const exceptions = EXCEPTION_STAGES.map((status) => ({
    status,
    count: counts[status] ?? 0,
  }));

  const completed: CompletedProfile[] = assignments
    .filter((assignment) => assignment.status === "SCORED" && assignment.result)
    .sort(
      (left, right) =>
        (right.submittedAt?.getTime() ?? 0) -
        (left.submittedAt?.getTime() ?? 0),
    )
    .slice(0, 4)
    .map((assignment) => {
      const result = assignment.result!;
      return {
        id: assignment.id,
        fullName: assignment.candidate.fullName,
        submittedAt: assignment.submittedAt,
        dimensions: normalizeDimensions(result.dimensionScores),
        contextCount: normalizeContextFlags(result.validityFlags).filter(
          (flag) => flag.triggered,
        ).length,
      };
    });

  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const subjectNames = new Map<string, string>();
  for (const assignment of assignments) {
    subjectNames.set(assignment.id, assignment.candidate.fullName);
    subjectNames.set(assignment.candidate.id, assignment.candidate.fullName);
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
      return sentence
        ? { id: event.id, sentence, at: event.createdAt }
        : null;
    })
    .filter((entry): entry is ActivityEntry => entry !== null);

  const lastActivityAt = feedEvents[0]?.createdAt ?? null;
  const roundId = selected?.id ?? null;

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
        {isAdmin && selected ? (
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/api/admin/export?round=${selected.id}`} />}
            >
              Export results
            </Button>
            {selected.status === "OPEN" ? (
              <Button
                nativeButton={false}
                render={<Link href={withRound("/admin/invite", roundId)} />}
              >
                Invite candidates
              </Button>
            ) : null}
          </>
        ) : null}
      </RoundSummary>

      {assignments.length === 0 ? (
        <EmptyRound>
          {isAdmin && selected?.status === "OPEN" ? (
            <EmptyRoundAdminActions />
          ) : null}
        </EmptyRound>
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
          {workspace.length > 0 ? (
            <section aria-labelledby="workspace-heading">
              <WorkspaceAttention items={workspace} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

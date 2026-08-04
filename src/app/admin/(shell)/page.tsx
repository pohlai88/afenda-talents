import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { EXCEPTION_STAGES } from "@/lib/status-display";
import { hiringAttention, workspaceAttention, type CandidateFacts } from "@/lib/attention";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";
import type { DimensionScore, ValidityFlag } from "@/lib/scoring";
import { RoundSummary } from "@/components/overview/round-summary";
import { WorkflowStrip } from "@/components/overview/workflow-strip";
import { HiringAttention, WorkspaceAttention } from "@/components/overview/attention-list";
import { RecentCompletions, type CompletedProfile } from "@/components/overview/recent-completions";
import { ActivityFeed, type ActivityEntry } from "@/components/overview/activity-feed";
import { EmptyRound } from "@/components/overview/empty-round";

export const dynamic = "force-dynamic";

/**
 * The operational overview (DECISIONS.md D17): read-only, derived entirely from rows the
 * system already writes. No new tracked event, no ranking, no composite score, and no
 * destructive control — purge lives on /admin/data, the registry on /admin/candidates.
 */
export default async function AdminOverviewPage() {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const now = new Date();

  const [candidates, responseActivity, viewEvents, feedEvents, users] = await Promise.all([
    db.candidate.findMany({ include: { result: true }, orderBy: { createdAt: "asc" } }),
    db.response.groupBy({ by: ["candidateId"], _max: { updatedAt: true } }),
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

  const lastResponseAt = new Map(responseActivity.map((r) => [r.candidateId, r._max.updatedAt]));
  // Ordered newest-first, so the first hit per subject is the latest view.
  const lastViewedAt = new Map<string, Date>();
  for (const event of viewEvents) {
    if (event.subjectId && !lastViewedAt.has(event.subjectId)) {
      lastViewedAt.set(event.subjectId, event.createdAt);
    }
  }

  const facts: CandidateFacts[] = candidates.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    status: c.status,
    sentAt: c.sentAt,
    openedAt: c.openedAt,
    startedAt: c.startedAt,
    expiresAt: c.expiresAt,
    lastResponseAt: lastResponseAt.get(c.id) ?? null,
    computedAt: c.result?.computedAt ?? null,
    lastViewedAt: lastViewedAt.get(c.id) ?? null,
  }));

  const attention = hiringAttention(facts, now);
  const workspace = workspaceAttention(users);

  const counts: Record<string, number> = {};
  for (const c of candidates) counts[c.status] = (counts[c.status] ?? 0) + 1;
  const exceptions = EXCEPTION_STAGES.map((status) => ({ status, count: counts[status] ?? 0 }));

  const completed: CompletedProfile[] = candidates
    .filter((c) => c.status === "SCORED" && c.result)
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      submittedAt: c.submittedAt,
      dimensions: c.result!.dimensionScores as unknown as DimensionScore[],
      contextCount: (c.result!.validityFlags as unknown as ValidityFlag[]).filter((f) => f.triggered)
        .length,
    }));

  // Names are resolved here, from the live tables — audit rows still store ids only.
  const userNames = new Map(users.map((u) => [u.id, u.name]));
  const candidateNames = new Map(candidates.map((c) => [c.id, c.fullName]));
  const entries: ActivityEntry[] = feedEvents
    .map((event) => {
      const sentence = activitySentence({
        action: event.action,
        actorName: userNames.get(event.actor) ?? null,
        subjectName: event.subjectId ? (candidateNames.get(event.subjectId) ?? null) : null,
      });
      return sentence ? { id: event.id, sentence, at: event.createdAt } : null;
    })
    .filter((entry): entry is ActivityEntry => entry !== null);

  const lastActivityAt = feedEvents[0]?.createdAt ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <RoundSummary
        firstName={firstName}
        total={candidates.length}
        ready={counts.SCORED ?? 0}
        needsAttention={attention.length}
        lastActivityAt={lastActivityAt}
        now={now}
        isAdmin={isAdmin}
      />

      {candidates.length === 0 ? (
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

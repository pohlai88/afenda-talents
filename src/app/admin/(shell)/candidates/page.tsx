import { Suspense } from "react";
import Link from "next/link";
import { CandidatesDatatable } from "@/components/candidates/candidates-datatable";
import type { CandidateTableItem } from "@/components/candidates/types";
import { NoCandidates } from "@/components/candidates/empty-states";
import { relativeTime } from "@/lib/relative-time";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import {
  resolveOperationalRound,
  withRound,
} from "@/lib/round-context";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  round?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const params = await searchParams;
  const { selected } = await resolveOperationalRound(first(params.round));
  const now = new Date();

  const assignments = selected
    ? await db.candidateAssignment.findMany({
        where: { hiringRoundId: selected.id },
        include: { candidate: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [responseActivity, users] = await Promise.all([
    assignmentIds.length > 0
      ? db.response.groupBy({
          by: ["assignmentId"],
          where: { assignmentId: { in: assignmentIds } },
          _max: { updatedAt: true },
        })
      : Promise.resolve([]),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  const lastResponseAt = new Map(
    responseActivity.map((row) => [row.assignmentId, row._max.updatedAt]),
  );
  const userNames = new Map(users.map((user) => [user.id, user.name]));

  const items: CandidateTableItem[] = assignments.map((assignment) => {
    const lastActivityAt =
      [
        lastResponseAt.get(assignment.id) ?? null,
        assignment.submittedAt,
        assignment.openedAt,
        assignment.sentAt,
      ]
        .filter((date): date is Date => date instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      id: assignment.candidateId,
      assignmentId: assignment.id,
      fullName: assignment.candidate.fullName,
      email: assignment.candidate.email,
      status: assignment.status,
      sentAt: assignment.sentAt?.toISOString() ?? null,
      submittedAt: assignment.submittedAt?.toISOString() ?? null,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      lastActivityLabel: lastActivityAt
        ? relativeTime(lastActivityAt, now)
        : "—",
      invitedByName: assignment.invitedById
        ? (userNames.get(assignment.invitedById) ?? null)
        : null,
    };
  });

  const roundId = selected?.id ?? null;
  const canInvite = isAdmin && selected?.status === "OPEN";

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6 overflow-x-hidden p-6">
      <PageHeader
        eyebrow={selected ? selected.name : "Hiring workspace"}
        title="Candidates"
        description={
          selected
            ? `Find and manage candidates assigned to ${selected.name}.`
            : "Create or select a hiring round to view candidates."
        }
        actions={
          isAdmin && selected ? (
            <>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={`/api/admin/export?round=${selected.id}`} />}
              >
                Export CSV
              </Button>
              {canInvite ? (
                <Button
                  nativeButton={false}
                  render={<Link href={withRound("/admin/invite", roundId)} />}
                >
                  Invite candidates
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {assignments.length === 0 ? (
        <NoCandidates>
          {canInvite ? (
            <Button
              nativeButton={false}
              render={<Link href={withRound("/admin/invite", roundId)} />}
            >
              Invite candidates
            </Button>
          ) : null}
        </NoCandidates>
      ) : (
        <Suspense
          fallback={
            <div
              className="flex flex-col gap-3"
              aria-busy="true"
              aria-live="polite"
            >
              <span className="sr-only">Loading candidates…</span>
              <div className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted" />
              <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
            </div>
          }
        >
          <CandidatesDatatable data={items} isAdmin={isAdmin} />
        </Suspense>
      )}
    </div>
  );
}

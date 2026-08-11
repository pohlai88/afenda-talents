import { Suspense } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin-page";
import { CandidatesDatatable } from "@/components/candidates/candidates-datatable";
import type { CandidateTableItem } from "@/components/candidates/types";
import { NoCandidates } from "@/components/candidates/empty-states";
import { relativeTime } from "@/lib/relative-time";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <AdminPage width="wide">
      <PageHeader
        eyebrow={selected ? selected.name : "Hiring workspace"}
        title="Candidates"
        description={
          selected
            ? `Search, filter, and manage the candidates assigned to ${selected.name}.`
            : "Create or select a hiring round to view candidate assignments."
        }
        meta={
          selected ? (
            <>
              <span className="text-muted-foreground">
                {selected.assessmentTitle} · v{selected.versionNumber}
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {assignments.length}
                </span>{" "}
                candidate{assignments.length === 1 ? "" : "s"}
              </span>
            </>
          ) : undefined
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
        <Suspense fallback={<CandidateRegistrySkeleton />}>
          <CandidatesDatatable data={items} isAdmin={isAdmin} />
        </Suspense>
      )}
    </AdminPage>
  );
}

function CandidateRegistrySkeleton() {
  return (
    <div
      className="flex min-w-0 flex-col gap-3"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading candidates…</span>
      <Skeleton className="h-11 w-full max-w-xl rounded-lg" />
      <Skeleton className="h-[28rem] w-full rounded-xl" />
    </div>
  );
}

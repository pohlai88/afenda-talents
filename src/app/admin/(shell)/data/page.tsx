import { redirect } from "next/navigation";
import { AuditExplorer } from "@/components/audit/audit-explorer";
import { DangerZone } from "@/components/danger-zone";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Retention, audit exploration, and purge — kept away from the daily workflow.
 * Names for the explorer are resolved from live tables only; the durable audit rows
 * continue to contain identifiers rather than names or email addresses.
 */
export default async function DataPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin");
  }

  const [events, users, candidates, assignments] = await Promise.all([
    db.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.candidate.findMany({ select: { id: true, fullName: true } }),
    db.candidateAssignment.findMany({
      select: {
        id: true,
        candidate: { select: { fullName: true } },
      },
    }),
  ]);

  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const subjectNames = new Map<string, string>();
  for (const candidate of candidates) {
    subjectNames.set(candidate.id, candidate.fullName);
  }
  for (const assignment of assignments) {
    subjectNames.set(assignment.id, assignment.candidate.fullName);
  }

  const rows = events.map((event) => {
    const subjectLabel = event.subjectId
      ? (subjectNames.get(event.subjectId) ?? userNames.get(event.subjectId) ?? null)
      : null;
    return {
      id: event.id,
      action: event.action,
      actorId: event.actor,
      actorName: userNames.get(event.actor) ?? null,
      subjectId: event.subjectId,
      subjectExists: subjectLabel !== null,
      subjectLabel,
      createdAt: event.createdAt.toISOString(),
      meta: event.meta,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-8 overflow-x-hidden p-6 lg:p-8">
      <PageHeader
        eyebrow="Governance"
        title="Data & audit"
        description="Review recorded activity, understand retention boundaries, and perform deliberate deletion from one controlled workspace."
      />

      <section aria-labelledby="audit-heading" className="flex flex-col gap-4">
        <div>
          <h2
            id="audit-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Audit activity
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Durable rows contain identifiers and timestamps only. Names shown below are
            resolved from records that still exist.
          </p>
        </div>
        <Card className="min-w-0">
          <CardContent className="pt-6">
            <AuditExplorer rows={rows} />
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="retention-heading"
        className="flex flex-col gap-4"
      >
        <div>
          <h2
            id="retention-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Data retention and deletion
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Destructive actions stay separate from day-to-day hiring work and require an
            explicit administrator decision.
          </p>
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-base leading-snug font-medium">
              Retention summary
            </h3>
            <CardDescription>
              Configured period: {env.RETENTION_DAYS} days from submission.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm md:grid-cols-3">
            <div className="space-y-1">
              <p className="font-medium">Deleted</p>
              <p className="text-muted-foreground">
                Candidate names, emails, answers, and scored results.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Retained</p>
              <p className="text-muted-foreground">
                Identity-free audit events with action, identifiers, timestamps, and
                non-identifying metadata.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Current workspace</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {candidates.length}
                </span>{" "}
                candidate{candidates.length === 1 ? "" : "s"} across all hiring rounds.
              </p>
            </div>
          </CardContent>
        </Card>

        <DangerZone
          retentionDays={env.RETENTION_DAYS}
          candidateCount={candidates.length}
        />
      </section>
    </div>
  );
}

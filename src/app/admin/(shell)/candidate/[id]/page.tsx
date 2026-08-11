import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { DimensionScale } from "@/components/candidate-detail/dimension-scale";
import { PrintProfileButton } from "@/components/candidate-detail/print-button";
import { CandidateProgressPanel } from "@/components/candidate-detail/progress-panel";
import { ResponseContextPanel } from "@/components/candidate-detail/response-context";
import { CandidateTimeline } from "@/components/candidate-detail/timeline";
import { CandidateAdminMenu } from "@/components/candidates/row-actions";
import { ItemResponsesTable } from "@/components/item-responses-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { audit } from "@/lib/audit";
import { requireHiringUser } from "@/lib/auth-admin";
import { buildCandidateTimeline } from "@/lib/candidate-timeline";
import { db } from "@/lib/db";
import {
  normalizeContextFlags,
  normalizeDimensions,
  type UiContextFlag,
  type UiDimension,
} from "@/lib/result-display";
import { withRound } from "@/lib/round-context";
import { orderedAnswerableItems } from "@/lib/instrument-document";
import { loadVersionDocument } from "@/lib/version-document";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  round?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Assignment detail: progress for open statuses, full profile when SCORED.
 * `id` is the CandidateAssignment id, so a person can hold independent records across
 * multiple hiring rounds. The URL is normalised to the assignment's authoritative
 * round before any profile view is audited.
 */
export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const { id } = await params;
  const requestedRoundId = first((await searchParams).round);

  const assignment = await db.candidateAssignment.findUnique({
    where: { id },
    include: {
      candidate: true,
      result: true,
      responses: true,
      hiringRound: { select: { id: true, name: true } },
      assessmentVersion: {
        select: {
          versionNumber: true,
          assessment: { select: { title: true } },
        },
      },
    },
  });
  if (!assignment) notFound();
  if (requestedRoundId !== assignment.hiringRoundId) {
    redirect(withRound(`/admin/candidate/${id}`, assignment.hiringRoundId));
  }

  const candidate = assignment.candidate;
  const assignmentStatus = assignment.status;
  const versionDoc = await loadVersionDocument(assignment.assessmentVersionId);
  const answerable = orderedAnswerableItems(versionDoc);
  const itemMeta = new Map(
    answerable.map((item, index) => {
      let dimension = "";
      if (item.type === "likert") {
        dimension = item.dimensionId
          ? (versionDoc.dimensions.find(
              (dimensionItem) => dimensionItem.id === item.dimensionId,
            )?.code ?? "VAL")
          : "VAL";
      }
      return [
        item.id,
        {
          order: index + 1,
          text: item.type === "info" ? "" : item.text,
          dimension,
        },
      ] as const;
    }),
  );

  const [inviter, auditRows] = await Promise.all([
    assignment.invitedById
      ? db.user.findUnique({
          where: { id: assignment.invitedById },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.auditEvent.findMany({
      where: {
        subjectId: assignment.id,
        action: { in: ["invite.resent", "invite.revoked"] },
      },
      orderBy: { createdAt: "asc" },
      select: { action: true, createdAt: true },
    }),
  ]);

  if (assignment.result) {
    await audit(session.userId, "result.viewed", assignment.id);
  }

  const timeline = buildCandidateTimeline(
    {
      sentAt: assignment.sentAt,
      openedAt: assignment.openedAt,
      consentedAt: assignment.consentedAt,
      startedAt: assignment.startedAt,
      submittedAt: assignment.submittedAt,
      scoredAt: assignment.result?.computedAt ?? null,
    },
    auditRows,
  );

  const answerableIds = new Set(answerable.map((item) => item.id));
  const answeredCount = assignment.responses.filter((response) =>
    answerableIds.has(response.questionId),
  ).length;
  const scored = Boolean(assignment.result);

  return (
    <AdminPage
      width="content"
      className="print:max-w-none print:gap-5 print:px-0 print:py-0"
    >
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          nativeButton={false}
          render={
            <Link
              href={withRound(
                "/admin/candidates",
                assignment.hiringRoundId,
              )}
            />
          }
        >
          ← Back to candidates
        </Button>
      </div>

      <PageHeader
        eyebrow={`${assignment.hiringRound.name} · Candidate record`}
        title={candidate.fullName}
        description={candidate.email}
        meta={
          <>
            <StatusBadge status={assignmentStatus} />
            <span className="text-muted-foreground">
              {assignment.assessmentVersion.assessment.title} · v
              {assignment.assessmentVersion.versionNumber}
            </span>
            <span className="text-muted-foreground">
              Invited{" "}
              <span className="tabular-nums">
                {assignment.sentAt?.toLocaleDateString("en-GB") ?? "—"}
              </span>
            </span>
            {assignment.submittedAt ? (
              <span className="text-muted-foreground">
                Submitted{" "}
                <span className="tabular-nums">
                  {assignment.submittedAt.toLocaleDateString("en-GB")}
                </span>
              </span>
            ) : null}
            {inviter?.name ? (
              <span className="text-muted-foreground">
                Invited by {inviter.name}
              </span>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {scored ? <PrintProfileButton /> : null}
            {isAdmin ? (
              <CandidateAdminMenu
                candidateId={candidate.id}
                assignmentId={assignment.id}
                fullName={candidate.fullName}
                status={assignmentStatus}
              />
            ) : null}
          </div>
        }
      />

      {scored && assignment.result ? (
        <>
          <div className="rounded-lg border bg-surface-subtle px-4 py-3 text-xs leading-5 text-muted-foreground print:border-0 print:bg-transparent print:px-0">
            This profile is a self-report and one input into a hiring decision. It is
            not a test score, a ranking, or a recommendation.
          </div>

          <ScoredProfile
            dimensions={normalizeDimensions(assignment.result.dimensionScores)}
            flags={normalizeContextFlags(assignment.result.validityFlags)}
            totalSeconds={assignment.result.totalSeconds}
            serverWindowSeconds={assignment.result.serverWindowSeconds}
            rows={assignment.responses
              .map((response) => {
                const meta = itemMeta.get(response.questionId);
                return {
                  order: meta?.order ?? 0,
                  text: meta?.text ?? response.questionId,
                  value: response.value ?? response.textValue ?? "",
                  dimension: meta?.dimension ?? "",
                };
              })
              .sort((left, right) => left.order - right.order)}
          />
        </>
      ) : (
        <CandidateProgressPanel
          status={assignmentStatus}
          answeredCount={answeredCount}
          totalItems={answerable.length}
        />
      )}

      <Card className="shadow-none print:border-0 print:shadow-none">
        <CardHeader className="border-b bg-surface-subtle print:bg-transparent">
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Key events for this invitation. Link secrets are never displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <CandidateTimeline events={timeline} />
        </CardContent>
      </Card>
    </AdminPage>
  );
}

function ScoredProfile({
  dimensions,
  flags,
  totalSeconds,
  serverWindowSeconds,
  rows,
}: {
  dimensions: UiDimension[];
  flags: UiContextFlag[];
  totalSeconds: number;
  serverWindowSeconds: number;
  rows: {
    order: number;
    text: string;
    value: number | string;
    dimension: string;
  }[];
}) {
  return (
    <>
      <Card className="shadow-none print:border-0 print:shadow-none">
        <CardHeader className="border-b bg-surface-subtle print:bg-transparent">
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Five separate dimensions scaled from 0–100. No overall score is produced.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y pt-2">
          {dimensions.map((dimension) => (
            <DimensionScale
              key={dimension.code}
              code={dimension.code}
              scaled={dimension.scaled}
              band={dimension.band}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none print:border-0 print:shadow-none">
        <CardHeader className="border-b bg-surface-subtle print:bg-transparent">
          <CardTitle>Response context</CardTitle>
          <CardDescription>
            Context for reading the profile. These indicators do not change any score.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponseContextPanel
            flags={flags}
            totalSeconds={totalSeconds}
            serverWindowSeconds={serverWindowSeconds}
          />
        </CardContent>
      </Card>

      <Card className="shadow-none print:border-0 print:shadow-none">
        <CardHeader className="border-b bg-surface-subtle print:bg-transparent">
          <CardTitle>Responses</CardTitle>
          <CardDescription>
            Item answers grouped by dimension; collapsed on screen and expanded in
            print.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ItemResponsesTable rows={rows} />
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimelineEvent } from "@/lib/candidate-timeline";
import type { UiContextFlag, UiDimension } from "@/lib/result-display";
import type { Status } from "@/lib/status-constants";
import { withRound } from "@/lib/round-url";

type DetailContext = {
  isAdmin: boolean;
  assignment: {
    id: string;
    status: Status;
    hiringRoundId: string;
    hiringRoundName: string;
    assessmentTitle: string;
    versionNumber: number;
    sentAt: string | null;
    submittedAt: string | null;
    inviterName: string | null;
  };
  candidate: {
    id: string;
    fullName: string;
    email: string;
  };
  progress: {
    answeredCount: number;
    totalItems: number;
  };
  timeline: Array<Omit<TimelineEvent, "at"> & { at: string }>;
  result: null | {
    dimensions: UiDimension[];
    flags: UiContextFlag[];
    totalSeconds: number;
    serverWindowSeconds: number;
    rows: Array<{
      order: number;
      text: string;
      value: number | string;
      dimension: string;
    }>;
  };
};

type DetailResponse = DetailContext & { error?: string };

export function CandidateDetailWorkspaceLoader({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [context, setContext] = useState<DetailContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/assignment/${encodeURIComponent(assignmentId)}/detail`,
          { method: "GET", cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as DetailResponse;
        if (!response.ok) {
          throw new Error(body.error ?? "Candidate record could not be loaded");
        }
        if (!cancelled) setContext(body);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Candidate record could not be loaded",
        );
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const timeline = useMemo<TimelineEvent[]>(
    () =>
      context?.timeline.map((event) => ({
        ...event,
        at: new Date(event.at),
      })) ?? [],
    [context],
  );

  if (error) {
    return (
      <AdminPage width="content">
        <Alert variant="destructive" role="alert">
          <AlertTitle>Candidate record unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AdminPage>
    );
  }

  if (!context) {
    return (
      <AdminPage width="content">
        <div className="space-y-5" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading candidate record…</span>
          <Skeleton className="h-10 w-52 rounded-lg" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AdminPage>
    );
  }

  const { assignment, candidate, result, progress, isAdmin } = context;
  const sentAt = assignment.sentAt ? new Date(assignment.sentAt) : null;
  const submittedAt = assignment.submittedAt
    ? new Date(assignment.submittedAt)
    : null;
  const scored = result !== null;

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
              href={withRound("/admin/candidates", assignment.hiringRoundId)}
            />
          }
        >
          ← Back to candidates
        </Button>
      </div>

      <PageHeader
        eyebrow={`${assignment.hiringRoundName} · Candidate record`}
        title={candidate.fullName}
        description={candidate.email}
        meta={
          <>
            <StatusBadge status={assignment.status} />
            <span className="text-muted-foreground">
              {assignment.assessmentTitle} · v{assignment.versionNumber}
            </span>
            <span className="text-muted-foreground">
              Invited{" "}
              <span className="tabular-nums">
                {sentAt?.toLocaleDateString("en-GB") ?? "—"}
              </span>
            </span>
            {submittedAt ? (
              <span className="text-muted-foreground">
                Submitted{" "}
                <span className="tabular-nums">
                  {submittedAt.toLocaleDateString("en-GB")}
                </span>
              </span>
            ) : null}
            {assignment.inviterName ? (
              <span className="text-muted-foreground">
                Invited by {assignment.inviterName}
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
                status={assignment.status}
              />
            ) : null}
          </div>
        }
      />

      {result ? (
        <>
          <div className="rounded-lg border bg-surface-subtle px-4 py-3 text-xs leading-5 text-muted-foreground print:border-0 print:bg-transparent print:px-0">
            This profile is a self-report and one input into a hiring decision. It is
            not a test score, a ranking, or a recommendation.
          </div>

          <ScoredProfile
            dimensions={result.dimensions}
            flags={result.flags}
            totalSeconds={result.totalSeconds}
            serverWindowSeconds={result.serverWindowSeconds}
            rows={result.rows}
          />
        </>
      ) : (
        <CandidateProgressPanel
          status={assignment.status}
          answeredCount={progress.answeredCount}
          totalItems={progress.totalItems}
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
  rows: Array<{
    order: number;
    text: string;
    value: number | string;
    dimension: string;
  }>;
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

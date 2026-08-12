"use client";

import { useEffect, useState } from "react";
import {
  AuditExplorer,
  type AuditExplorerRow,
} from "@/components/audit/audit-explorer";
import { DangerZone } from "@/components/danger-zone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DataContext = {
  rows: AuditExplorerRow[];
  retentionDays: number;
  candidateCount: number;
};

type DataContextResponse = DataContext & { error?: string };

export function DataWorkspaceLoader({ refreshNonce }: { refreshNonce: number }) {
  const [context, setContext] = useState<DataContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch("/api/admin/data", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as DataContextResponse;
        if (!response.ok) {
          throw new Error(body.error ?? "Data workspace could not be loaded");
        }
        if (!cancelled) setContext(body);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Data workspace could not be loaded",
        );
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Data workspace unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!context) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading data and audit workspace…</span>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="audit-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="audit-heading" className="text-lg font-semibold tracking-tight">
            Audit activity
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Durable rows contain identifiers and timestamps only. Names shown below are
            resolved from records that still exist.
          </p>
        </div>
        <Card className="min-w-0">
          <CardContent className="pt-6">
            <AuditExplorer rows={context.rows} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="retention-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="retention-heading" className="text-lg font-semibold tracking-tight">
            Data retention and deletion
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Destructive actions stay separate from day-to-day hiring work and require an
            explicit administrator decision.
          </p>
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-base leading-snug font-medium">Retention summary</h3>
            <CardDescription>
              Configured period: {context.retentionDays} days from submission.
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
                  {context.candidateCount}
                </span>{" "}
                candidate{context.candidateCount === 1 ? "" : "s"} across all hiring rounds.
              </p>
            </div>
          </CardContent>
        </Card>

        <DangerZone
          retentionDays={context.retentionDays}
          candidateCount={context.candidateCount}
        />
      </section>
    </>
  );
}

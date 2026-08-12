"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidatesDatatable } from "@/components/candidates/candidates-datatable";
import { NoCandidates } from "@/components/candidates/empty-states";
import type { CandidateTableItem } from "@/components/candidates/types";
import { PageHeader } from "@/components/page-header";
import { withRound } from "@/lib/round-url";

type SelectedRound = {
  id: string;
  name: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
  assessmentTitle: string;
  versionNumber: number;
};

type CandidateRegistryContext = {
  isAdmin: boolean;
  canInvite: boolean;
  selected: SelectedRound | null;
  items: CandidateTableItem[];
};

type CandidateRegistryResponse = CandidateRegistryContext & { error?: string };

export function CandidatesWorkspaceLoader({
  requestedRoundId,
  refreshNonce,
}: {
  requestedRoundId: string | null;
  refreshNonce: number;
}) {
  const [context, setContext] = useState<CandidateRegistryContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      setError(null);
      const params = new URLSearchParams();
      if (requestedRoundId) params.set("round", requestedRoundId);
      const suffix = params.size > 0 ? `?${params.toString()}` : "";

      try {
        const response = await fetch(`/api/admin/candidates${suffix}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as CandidateRegistryResponse;
        if (!response.ok) {
          throw new Error(body.error ?? "Candidate registry could not be loaded");
        }
        if (!cancelled) setContext(body);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Candidate registry could not be loaded",
        );
      }
    }

    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [requestedRoundId, refreshNonce]);

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Candidate registry unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!context) return <CandidateRegistrySkeleton />;

  const { selected, items, isAdmin, canInvite } = context;
  const roundId = selected?.id ?? null;

  return (
    <>
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
                  {items.length}
                </span>{" "}
                candidate{items.length === 1 ? "" : "s"}
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

      {items.length === 0 ? (
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
        <CandidatesDatatable data={items} isAdmin={isAdmin} />
      )}
    </>
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

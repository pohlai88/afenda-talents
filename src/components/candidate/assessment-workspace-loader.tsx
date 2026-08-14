"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AssessmentForm,
  type AssessmentFormBlock,
} from "@/components/assessment-form";
import { CandidateShell } from "@/components/candidate/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type AssessmentContext = {
  blocks: AssessmentFormBlock[];
  saved: Record<string, { value?: number; textValue?: string }>;
};

type AssessmentContextResponse = AssessmentContext & {
  error?: string;
  action?: "done" | "reenter";
};

export function AssessmentWorkspaceLoader({ token }: { token: string }) {
  const router = useRouter();
  const [context, setContext] = useState<AssessmentContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessment() {
      try {
        const response = await fetch(
          `/api/candidate/assessment?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as AssessmentContextResponse;
        if (!response.ok) {
          if (body.action === "reenter") {
            router.replace(`/a/${token}`);
            return;
          }
          if (body.action === "done") {
            router.replace(`/a/${token}/done`);
            return;
          }
          throw new Error(body.error ?? "Assessment could not be loaded");
        }
        if (!cancelled) setContext(body);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Assessment could not be loaded",
        );
      }
    }

    void loadAssessment();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (error) {
    return (
      <CandidateShell>
        <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-6 outline-none">
          <Alert variant="destructive" role="alert">
            <AlertTitle>Assessment unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </main>
      </CandidateShell>
    );
  }

  if (!context) {
    return (
      <CandidateShell>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-xl space-y-4 px-4 py-5 pb-40 outline-none"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading assessment…</span>
          <h1 className="text-lg font-semibold tracking-tight">Your self-assessment</h1>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </main>
      </CandidateShell>
    );
  }

  return <AssessmentForm token={token} blocks={context.blocks} saved={context.saved} />;
}

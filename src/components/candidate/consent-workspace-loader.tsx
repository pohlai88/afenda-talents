"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConsentForm } from "@/components/consent-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type ConsentContext = {
  fullName: string;
  candidateIntroduction: string;
  estimatedMinutes: number;
  itemCount: number;
  consent: {
    purpose: string;
    whatWeCollect: string;
    whoSeesIt: string;
    retention: string;
  };
};

type ConsentContextResponse = ConsentContext & {
  error?: string;
  action?: "done" | "reenter" | "assessment";
};

export function ConsentWorkspaceLoader({ token }: { token: string }) {
  const router = useRouter();
  const [context, setContext] = useState<ConsentContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const response = await fetch(
          `/api/candidate/consent?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as ConsentContextResponse;
        if (!response.ok) {
          if (body.action === "reenter") {
            router.replace(`/a/${token}`);
            return;
          }
          if (body.action === "assessment") {
            router.replace(`/a/${token}/assessment`);
            return;
          }
          if (body.action === "done") {
            router.replace(`/a/${token}/done`);
            return;
          }
          throw new Error(body.error ?? "Assessment details could not be loaded");
        }
        if (!cancelled) setContext(body);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Assessment details could not be loaded",
        );
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (error) {
    return (
      <Alert variant="destructive" role="alert" className="mt-5">
        <AlertTitle>Assessment unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!context) {
    return (
      <div className="mt-5 space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading assessment details…</span>
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Hello {context.fullName},
      </p>

      <Card className="mt-5 border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">At a glance</CardTitle>
          <CardDescription>What to expect before you start.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
            <li>{context.candidateIntroduction}</li>
            <li>
              {context.itemCount} short statement{context.itemCount === 1 ? "" : "s"} about
              how you work
            </li>
            <li>About {context.estimatedMinutes} minutes</li>
            <li>
              <strong className="font-medium text-foreground">
                No right or wrong answers
              </strong>{" "}
              — not a pass/fail test
            </li>
            <li>Your answers save as you go</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <section>
          <h2 className="font-medium text-foreground">Purpose</h2>
          <p className="mt-1.5 text-muted-foreground">{context.consent.purpose}</p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">What we collect</h2>
          <p className="mt-1.5 text-muted-foreground">
            {context.consent.whatWeCollect}
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">Who sees it</h2>
          <p className="mt-1.5 text-muted-foreground">{context.consent.whoSeesIt}</p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">How long we keep it</h2>
          <p className="mt-1.5 text-muted-foreground">{context.consent.retention}</p>
        </section>
      </div>

      <ConsentForm token={token} />
    </>
  );
}

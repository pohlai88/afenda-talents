"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { InviteWorkflow } from "@/components/invite-workflow";
import {
  InviteWorkspace,
  type InviteRoundOption,
} from "@/components/invite-workspace";

type InviteContext = {
  ttlDays: number;
  mailFrom: string;
  openRounds: InviteRoundOption[];
  roundExistingEmails: Record<string, string[]>;
  invitationPreviewHtml: string;
  receiptPreviewHtml: string;
};

type InviteContextResponse = InviteContext & { error?: string };

export function InviteWorkspaceLoader({
  requestedRoundId,
  refreshNonce,
}: {
  requestedRoundId: string | null;
  refreshNonce: number;
}) {
  const [context, setContext] = useState<InviteContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setError(null);
      try {
        const response = await fetch("/api/admin/invite", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as InviteContextResponse;
        if (!response.ok) {
          throw new Error(body.error ?? "Invitation context could not be loaded");
        }
        if (cancelled) return;

        const openRounds = [...body.openRounds];
        if (requestedRoundId) {
          openRounds.sort((left, right) => {
            if (left.id === requestedRoundId) return -1;
            if (right.id === requestedRoundId) return 1;
            return 0;
          });
        }
        setContext({ ...body, openRounds });
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Invitation context could not be loaded",
        );
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [requestedRoundId, refreshNonce]);

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Invitation workspace unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!context) {
    return (
      <Card aria-busy="true">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading invitation workspace…
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <InviteWorkflow ttlDays={context.ttlDays} />
      <InviteWorkspace
        ttlDays={context.ttlDays}
        mailFrom={context.mailFrom}
        openRounds={context.openRounds}
        roundExistingEmails={context.roundExistingEmails}
        invitationPreviewHtml={context.invitationPreviewHtml}
        receiptPreviewHtml={context.receiptPreviewHtml}
      />
    </>
  );
}

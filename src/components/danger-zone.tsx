"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CONFIRMATION = "DELETE ALL CANDIDATE DATA";

export function DangerZone({ retentionDays }: { retentionDays: number }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function purge() {
    setBusy(true);
    const response = await fetch("/api/admin/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? `Deleted ${body.deleted} candidate record(s).` : body.error);
    setConfirmation("");
    router.refresh();
  }

  return (
    <Card className="border-destructive/40 print:hidden">
      <CardHeader>
        <CardTitle className="text-destructive">Delete candidate data</CardTitle>
        <CardDescription>
          Candidates were told their responses are kept for {retentionDays} days from
          submission. Honouring that is a manual step — this is how you do it. Names, emails,
          answers and results are removed permanently. The audit log keeps a record that the
          deletion happened, with no personal data in it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            name="purge-confirmation"
            autoComplete="off"
            spellCheck={false}
            aria-label="Confirmation phrase"
            placeholder={CONFIRMATION}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={busy || confirmation !== CONFIRMATION}
            onClick={purge}
          >
            {busy ? "Deleting…" : "Delete all candidate data"}
          </Button>
        </div>
        {message && (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

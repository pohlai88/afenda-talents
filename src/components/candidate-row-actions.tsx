"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function CandidateRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function call(action: "resend" | "revoke") {
    setBusy(true);
    await fetch(`/api/admin/invite/${id}/${action}`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  const canResend = status === "SENT" || status === "EXPIRED" || status === "REVOKED";
  const canRevoke = status === "SENT" || status === "STARTED";

  return (
    <div className="flex justify-end gap-2">
      {canResend && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call("resend")}>
          Resend
        </Button>
      )}
      {canRevoke && (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRevoke(true)}>
            Revoke
          </Button>
          <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
                <AlertDialogDescription>
                  The candidate&apos;s link stops working immediately
                  {status === "STARTED" && " and their saved answers stay on record"}. You can
                  issue a fresh link later with Resend.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep invitation</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    await call("revoke");
                    setConfirmRevoke(false);
                  }}
                >
                  Revoke invitation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

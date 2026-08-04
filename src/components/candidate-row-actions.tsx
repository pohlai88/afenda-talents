"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CandidateRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call("revoke")}>
          Revoke
        </Button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaField } from "@/components/afenda/form-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DUE_ITEM_GUIDANCE } from "@/lib/corporate-admin/workflow-guidance";

export function ObligationActions({ id, status, recurring, nextDueDate, currency, expectedAmount, isAdmin, canActivate = true }: {
  id: string;
  status: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED";
  recurring: boolean;
  nextDueDate: string | null;
  currency: string;
  expectedAmount: number | null;
  isAdmin: boolean;
  canActivate?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [amount, setAmount] = useState(expectedAmount == null ? "" : String(expectedAmount));

  async function call(url: string, body: unknown, method = "POST", success = "Updated.") {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Operation failed");
      toast.success(success);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" ? <Button disabled={busy || !canActivate} onClick={() => void call(`/api/admin/corporate/obligations/${id}`, { action: "ACTIVATE" }, "PATCH", "Obligation activated.")}>Activate</Button> : null}
        {status === "ACTIVE" && recurring && nextDueDate ? <Button disabled={busy} onClick={() => void call(`/api/admin/corporate/obligations/${id}/due-items`, { mode: "NEXT" }, "POST", `Due item ${nextDueDate} created.`)}>Generate next due</Button> : null}
        {status === "ACTIVE" ? <Button variant="outline" disabled={busy} onClick={() => setManualOpen(true)}>Add manual due</Button> : null}
        {status === "ACTIVE" ? (
          <AfendaConfirmButton
            busy={busy}
            title="Mark this obligation as ended?"
            description="This closes the obligation lifecycle. Existing due items and payment history remain available, but no further scheduled action should be generated from this record."
            confirmLabel="Mark ended"
            onConfirm={() => call(`/api/admin/corporate/obligations/${id}`, { action: "END" }, "PATCH", "Obligation ended.")}
          >
            Mark ended
          </AfendaConfirmButton>
        ) : null}
        {status === "DRAFT" || status === "ACTIVE" ? (
          <AfendaConfirmButton
            busy={busy}
            destructive
            title="Cancel this obligation?"
            description="Cancellation stops this obligation from progressing normally. Historical information remains for audit and reference, but the obligation cannot be reactivated in the current lifecycle."
            confirmLabel="Cancel obligation"
            onConfirm={() => call(`/api/admin/corporate/obligations/${id}`, { action: "CANCEL" }, "PATCH", "Obligation cancelled.")}
          >
            Cancel obligation
          </AfendaConfirmButton>
        ) : null}
      </div>
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add manual due item</DialogTitle><DialogDescription>Use this for one-off charges, exceptional invoices or a schedule occurrence that should not advance recurrence.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <AfendaField label="Due date" id="manual-due-date" required guidance={DUE_ITEM_GUIDANCE.dueDate}><Input id="manual-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></AfendaField>
            <AfendaField label="Period label" id="manual-period" guidance={DUE_ITEM_GUIDANCE.periodLabel}><Input id="manual-period" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="2026-08 or Deposit" /></AfendaField>
            <AfendaField label={`Expected amount (${currency})`} id="manual-amount" className="sm:col-span-2" guidance={DUE_ITEM_GUIDANCE.expectedAmount}><Input id="manual-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></AfendaField>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setManualOpen(false)} disabled={busy}>Close</Button><Button disabled={busy || !dueDate} onClick={async () => { const ok = await call(`/api/admin/corporate/obligations/${id}/due-items`, { mode: "MANUAL", dueDate, periodLabel: periodLabel || undefined, expectedAmount: amount === "" ? null : Number(amount), currency }, "POST", "Manual due item added."); if (ok) setManualOpen(false); }}>Add due item</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

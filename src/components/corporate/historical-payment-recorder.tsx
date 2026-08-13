"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import type { DueItemDto } from "@/components/corporate/workflow-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_SUGGESTIONS } from "@/lib/corporate-admin/domain";
import { todayDateOnly } from "@/components/corporate/status";

export function HistoricalPaymentRecorder({ dueItem }: { dueItem: DueItemDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = dueItem.invoiceAmount ?? dueItem.expectedAmount;
  const recorded = useMemo(() => dueItem.payments.reduce((sum, payment) => payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID" ? sum + (payment.paidAmount ?? 0) : sum, 0), [dueItem.payments]);
  const suggested = target == null ? "" : String(Math.max(0, target - recorded));
  const [paidAmount, setPaidAmount] = useState(suggested);
  const [paymentDate, setPaymentDate] = useState(todayDateOnly());
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [reconciled, setReconciled] = useState(false);
  const [notes, setNotes] = useState("");

  async function record() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/payments/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "MANUAL",
          rows: [{
            dueItemId: dueItem.id,
            paidAmount: Number(paidAmount),
            paymentDate,
            paymentMethod,
            paymentReference: paymentReference || null,
            paymentProofUrl: paymentProofUrl || null,
            reconciled,
            notes: notes || null,
          }],
        }),
      });
      const data = await response.json().catch(() => ({}));
      const row = data.rows?.[0];
      if (!response.ok || row?.status === "ERROR") throw new Error(row?.error ?? data.error ?? "Could not record historical payment");
      if (row?.status === "DUPLICATE") toast.info("This historical payment already appears to be recorded.");
      else toast.success("Historical payment recorded.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record historical payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setPaidAmount(suggested); setOpen(true); }}>Record historical payment</Button>
      <AfendaResponsiveOverlay
        open={open}
        onOpenChange={setOpen}
        title="Record historical payment"
        description="Use this for money already paid before the current workflow was in use. It records history directly and does not create a new approval request."
        contentClassName="sm:max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button disabled={busy || Number(paidAmount) <= 0 || !paymentDate || !paymentMethod} onClick={() => void record()}>{busy ? "Recording…" : "Record history"}</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AfendaField label={`Paid amount (${dueItem.currency})`} id={`historical-paid-${dueItem.id}`} required guidance="Actual amount already paid. This may be a full or partial historical settlement."><Input id={`historical-paid-${dueItem.id}`} type="number" min="0.01" step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} /></AfendaField>
          <AfendaField label="Payment date" id={`historical-date-${dueItem.id}`} required guidance="The original bank/payment date, not today's data-entry date."><Input id={`historical-date-${dueItem.id}`} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></AfendaField>
          <AfendaField label="Payment method" id={`historical-method-${dueItem.id}`} required guidance="Original settlement channel where known."><Input id={`historical-method-${dueItem.id}`} list={`historical-payment-methods-${dueItem.id}`} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} /><datalist id={`historical-payment-methods-${dueItem.id}`}>{PAYMENT_METHOD_SUGGESTIONS.map((method) => <option key={method} value={method} />)}</datalist></AfendaField>
          <AfendaField label="Reference" id={`historical-reference-${dueItem.id}`} guidance="Bank reference, cheque number, receipt number or other legacy identifier."><Input id={`historical-reference-${dueItem.id}`} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></AfendaField>
          <AfendaField label="Evidence URL" id={`historical-proof-${dueItem.id}`} className="sm:col-span-2" guidance="Optional link to bank proof, receipt, voucher or archived evidence."><Input id={`historical-proof-${dueItem.id}`} type="url" value={paymentProofUrl} onChange={(event) => setPaymentProofUrl(event.target.value)} /></AfendaField>
          <div className="sm:col-span-2"><AfendaCheckField label="Already independently reconciled" checked={reconciled} onChange={setReconciled} guidance="Only enable when the historical payment and evidence have already been independently verified. Otherwise leave it for the normal reconciliation step." /></div>
          <AfendaField label="Notes" id={`historical-notes-${dueItem.id}`} className="sm:col-span-2" guidance="Migration source, legacy voucher number or any uncertainty that should remain visible."><Textarea id={`historical-notes-${dueItem.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} /></AfendaField>
        </div>
      </AfendaResponsiveOverlay>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaField } from "@/components/afenda/form-layout";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import type { DueItemDto, PaymentDto } from "@/components/corporate/workflow-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_SUGGESTIONS } from "@/lib/corporate-admin/domain";
import { PAYMENT_GUIDANCE } from "@/lib/corporate-admin/workflow-guidance";

function isHistorical(payment: PaymentDto): boolean {
  return !payment.approvalRequired && payment.recordOrigin !== "WORKFLOW";
}

export function PaymentWorkflow({ dueItem, fields, isAdmin }: { dueItem: DueItemDto; fields: CorporateCustomFieldDefinitionDto[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [approval, setApproval] = useState<PaymentDto | null>(null);
  const [recording, setRecording] = useState<PaymentDto | null>(null);
  const target = dueItem.invoiceAmount ?? dueItem.expectedAmount;
  const recorded = useMemo(() => dueItem.payments.reduce((sum, payment) => payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID" ? sum + (payment.paidAmount ?? 0) : sum, 0), [dueItem.payments]);
  const outstanding = target == null ? null : Math.max(0, target - recorded);
  const [requestAmount, setRequestAmount] = useState(outstanding == null ? "" : String(outstanding));
  const [requestNotes, setRequestNotes] = useState("");
  const [requestCustom, setRequestCustom] = useState<Record<string, unknown>>({});
  const [approvedAmount, setApprovedAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDateOnly());
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");

  async function call(url: string, body: unknown, method: "POST" | "PATCH", success: string) {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm"><span className="text-muted-foreground">Outstanding </span><span className="font-medium tabular-nums">{outstanding == null ? "Not set" : formatMoney(dueItem.currency, outstanding)}</span></div>
        {isAdmin && dueItem.status === "OPEN" && (outstanding == null || outstanding > 0) ? <Button size="sm" onClick={() => { setRequestAmount(outstanding == null ? "" : String(outstanding)); setRequestOpen(true); }}>Request payment</Button> : null}
      </div>

      {dueItem.payments.length === 0 ? (
        <AfendaEmptyState title="No payment records yet" description="Use the normal request workflow for new payments, or record historical payment evidence for money already paid." compact />
      ) : (
        <ul className="flex flex-col gap-2">{dueItem.payments.map((payment) => {
          const historical = isHistorical(payment);
          return (
            <li key={payment.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium tabular-nums">{historical ? `Historical payment ${formatMoney(dueItem.currency, payment.paidAmount ?? payment.requestedAmount)}` : `Requested ${formatMoney(dueItem.currency, payment.requestedAmount)}`}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">{historical ? <CorporateStatusBadge status="HISTORICAL" /> : <CorporateStatusBadge status={payment.approvalStatus} />}<CorporateStatusBadge status={payment.paymentStatus} />{payment.reconciledAt ? <CorporateStatusBadge status="RECONCILED" /> : null}</div>
                </div>
                {isAdmin ? <div className="flex flex-wrap gap-2">
                  {!historical && payment.approvalStatus === "PENDING" ? <><Button size="sm" onClick={() => { setApprovedAmount(String(payment.requestedAmount)); setApproval(payment); }}>Approve</Button><AfendaConfirmButton busy={busy} destructive title="Reject this payment request?" description="The request will move to Rejected and cannot continue to settlement under its current approval lifecycle. The due item remains available for a new payment request if needed." confirmLabel="Reject request" onConfirm={() => call(`/api/admin/corporate/payments/${payment.id}`, { action: "REJECT" }, "PATCH", "Payment request rejected.")}>Reject</AfendaConfirmButton></> : null}
                  {!historical && payment.approvalStatus === "APPROVED" && payment.paymentStatus === "NOT_PAID" ? <Button size="sm" onClick={() => { setPaidAmount(String(payment.approvedAmount ?? payment.requestedAmount)); setPaymentDate(todayDateOnly()); setRecording(payment); }}>Record payment</Button> : null}
                  {(payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID") && !payment.reconciledAt ? <><AfendaConfirmButton busy={busy} title="Reconcile this payment?" description="Reconciliation records that the settlement evidence and recorded payment have been checked. Only confirm after the payment has been independently verified." confirmLabel="Reconcile payment" onConfirm={() => call(`/api/admin/corporate/payments/${payment.id}`, { action: "RECONCILE" }, "PATCH", "Payment reconciled.")}>Reconcile</AfendaConfirmButton><AfendaConfirmButton busy={busy} destructive title="Void this recorded payment?" description="Voiding removes this settlement from the amount counted as paid and may reopen the due item. Use this only when the recorded payment should no longer be treated as a valid settlement." confirmLabel="Void payment" onConfirm={() => call(`/api/admin/corporate/payments/${payment.id}`, { action: "VOID", notes: "Voided from Corporate Administration" }, "PATCH", "Payment voided.")}>Void</AfendaConfirmButton></> : null}
                </div> : null}
              </div>
              {payment.approvedAmount != null || payment.paidAmount != null ? (
                <AfendaMetadataGrid columns={3} className="mt-3" items={[
                  { label: historical ? "History source" : "Approved", value: historical ? payment.recordOrigin.replaceAll("_", " ") : formatMoney(dueItem.currency, payment.approvedAmount) },
                  { label: "Paid", value: formatMoney(dueItem.currency, payment.paidAmount) },
                  { label: "Reference", value: payment.paymentReference || "—" },
                ]} />
              ) : null}
            </li>
          );
        })}</ul>
      )}

      <AfendaResponsiveOverlay
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title="Request payment"
        description="Request against the current outstanding balance. Approval is recorded separately."
        contentClassName="sm:max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button><Button disabled={busy || Number(requestAmount) <= 0} onClick={async () => { const ok = await call(`/api/admin/corporate/due-items/${dueItem.id}/payments`, { requestedAmount: Number(requestAmount), notes: requestNotes || null, customFields: requestCustom }, "POST", "Payment requested."); if (ok) { setRequestOpen(false); setRequestNotes(""); setRequestCustom({}); } }}>Request</Button></>}
      >
        <div className="flex flex-col gap-4">
          <AfendaField label={`Amount (${dueItem.currency})`} id={`request-${dueItem.id}`} required guidance={PAYMENT_GUIDANCE.requestAmount}><Input id={`request-${dueItem.id}`} type="number" min="0.01" step="0.01" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} /></AfendaField>
          <AfendaField label="Notes" id={`request-notes-${dueItem.id}`} guidance={PAYMENT_GUIDANCE.requestNotes}><Textarea id={`request-notes-${dueItem.id}`} value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} /></AfendaField>
          <CustomFieldControls definitions={fields} values={requestCustom} onChange={setRequestCustom} />
        </div>
      </AfendaResponsiveOverlay>

      <AfendaResponsiveOverlay
        open={approval !== null}
        onOpenChange={(open) => !open && setApproval(null)}
        title="Approve payment"
        description="Approval cannot exceed the request or the due item’s uncommitted balance."
        footer={<><Button variant="outline" onClick={() => setApproval(null)}>Cancel</Button><Button disabled={busy || !approval || Number(approvedAmount) <= 0} onClick={async () => { if (!approval) return; const ok = await call(`/api/admin/corporate/payments/${approval.id}`, { action: "APPROVE", approvedAmount: Number(approvedAmount) }, "PATCH", "Payment approved."); if (ok) setApproval(null); }}>Approve</Button></>}
      >
        <AfendaField label={`Approved amount (${dueItem.currency})`} id="approval-amount" required guidance={PAYMENT_GUIDANCE.approvedAmount}><Input id="approval-amount" type="number" min="0.01" step="0.01" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} /></AfendaField>
      </AfendaResponsiveOverlay>

      <AfendaResponsiveOverlay
        open={recording !== null}
        onOpenChange={(open) => !open && setRecording(null)}
        title="Record payment"
        description="Capture the actual settlement details and proof link. Reconciliation remains a separate step."
        contentClassName="sm:max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setRecording(null)}>Cancel</Button><Button disabled={busy || !recording || Number(paidAmount) <= 0 || !paymentDate || !paymentMethod} onClick={async () => { if (!recording) return; const ok = await call(`/api/admin/corporate/payments/${recording.id}`, { action: "RECORD_PAYMENT", paidAmount: Number(paidAmount), paymentDate, paymentMethod, paymentReference: paymentReference || null, paymentProofUrl: paymentProofUrl || null }, "PATCH", "Payment recorded."); if (ok) { setRecording(null); setPaymentReference(""); setPaymentProofUrl(""); } }}>Record</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AfendaField label={`Paid amount (${dueItem.currency})`} id="paid-amount" required guidance={PAYMENT_GUIDANCE.paidAmount}><Input id="paid-amount" type="number" min="0.01" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></AfendaField>
          <AfendaField label="Payment date" id="paid-date" required guidance={PAYMENT_GUIDANCE.paymentDate}><Input id="paid-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></AfendaField>
          <AfendaField label="Method" id="paid-method" required guidance={PAYMENT_GUIDANCE.paymentMethod}><Input id="paid-method" list="corporate-payment-methods" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} /><datalist id="corporate-payment-methods">{PAYMENT_METHOD_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></AfendaField>
          <AfendaField label="Reference" id="paid-ref" guidance={PAYMENT_GUIDANCE.paymentReference}><Input id="paid-ref" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /></AfendaField>
          <AfendaField label="Payment proof URL" id="paid-proof" className="sm:col-span-2" guidance={PAYMENT_GUIDANCE.paymentProofUrl}><Input id="paid-proof" type="url" value={paymentProofUrl} onChange={(e) => setPaymentProofUrl(e.target.value)} placeholder="https://…" /></AfendaField>
        </div>
      </AfendaResponsiveOverlay>
    </div>
  );
}

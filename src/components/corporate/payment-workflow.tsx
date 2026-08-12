"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import type { DueItemDto, PaymentDto } from "@/components/corporate/workflow-types";
import { PAYMENT_METHOD_SUGGESTIONS } from "@/lib/corporate-admin/domain";

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
      toast.success(success); router.refresh(); return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Operation failed"); return false; }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm"><span className="text-muted-foreground">Outstanding </span><span className="font-medium tabular-nums">{outstanding == null ? "Not set" : formatMoney(dueItem.currency, outstanding)}</span></div>
        {isAdmin && dueItem.status === "OPEN" && (outstanding == null || outstanding > 0) ? <Button size="sm" onClick={() => { setRequestAmount(outstanding == null ? "" : String(outstanding)); setRequestOpen(true); }}>Request payment</Button> : null}
      </div>

      {dueItem.payments.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No payment requests yet.</p> : (
        <ul className="space-y-2">{dueItem.payments.map((payment) => (
          <li key={payment.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-medium tabular-nums">Requested {formatMoney(dueItem.currency, payment.requestedAmount)}</p><div className="mt-1 flex flex-wrap gap-1.5"><CorporateStatusBadge status={payment.approvalStatus} /><CorporateStatusBadge status={payment.paymentStatus} />{payment.reconciledAt ? <CorporateStatusBadge status="RECONCILED" /> : null}</div></div>
              {isAdmin ? <div className="flex flex-wrap gap-2">
                {payment.approvalStatus === "PENDING" ? <><Button size="sm" onClick={() => { setApprovedAmount(String(payment.requestedAmount)); setApproval(payment); }}>Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void call(`/api/admin/corporate/payments/${payment.id}`, { action: "REJECT" }, "PATCH", "Payment request rejected.")}>Reject</Button></> : null}
                {payment.approvalStatus === "APPROVED" && payment.paymentStatus === "NOT_PAID" ? <Button size="sm" onClick={() => { setPaidAmount(String(payment.approvedAmount ?? payment.requestedAmount)); setPaymentDate(todayDateOnly()); setRecording(payment); }}>Record payment</Button> : null}
                {(payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID") && !payment.reconciledAt ? <><Button size="sm" variant="outline" disabled={busy} onClick={() => void call(`/api/admin/corporate/payments/${payment.id}`, { action: "RECONCILE" }, "PATCH", "Payment reconciled.")}>Reconcile</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void call(`/api/admin/corporate/payments/${payment.id}`, { action: "VOID", notes: "Voided from Corporate Administration" }, "PATCH", "Payment voided.")}>Void</Button></> : null}
              </div> : null}
            </div>
            {payment.approvedAmount != null || payment.paidAmount != null ? <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p><span className="text-muted-foreground">Approved </span>{formatMoney(dueItem.currency, payment.approvedAmount)}</p><p><span className="text-muted-foreground">Paid </span>{formatMoney(dueItem.currency, payment.paidAmount)}</p><p className="truncate"><span className="text-muted-foreground">Reference </span>{payment.paymentReference || "—"}</p></div> : null}
          </li>
        ))}</ul>
      )}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Request payment</DialogTitle><DialogDescription>Request against the current outstanding balance. Approval is recorded separately.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor={`request-${dueItem.id}`}>Amount ({dueItem.currency})</Label><Input id={`request-${dueItem.id}`} type="number" min="0.01" step="0.01" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} /></div><div className="space-y-2"><Label htmlFor={`request-notes-${dueItem.id}`}>Notes</Label><Textarea id={`request-notes-${dueItem.id}`} value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} /></div><CustomFieldControls definitions={fields} values={requestCustom} onChange={setRequestCustom} /></div><DialogFooter><Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button><Button disabled={busy || Number(requestAmount) <= 0} onClick={async () => { const ok = await call(`/api/admin/corporate/due-items/${dueItem.id}/payments`, { requestedAmount: Number(requestAmount), notes: requestNotes || null, customFields: requestCustom }, "POST", "Payment requested."); if (ok) { setRequestOpen(false); setRequestNotes(""); setRequestCustom({}); } }}>Request</Button></DialogFooter></Dialog>

      <Dialog open={approval !== null} onOpenChange={(open) => !open && setApproval(null)}><DialogContent><DialogHeader><DialogTitle>Approve payment</DialogTitle><DialogDescription>Approval cannot exceed the request or the due item’s uncommitted balance.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="approval-amount">Approved amount ({dueItem.currency})</Label><Input id="approval-amount" type="number" min="0.01" step="0.01" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setApproval(null)}>Cancel</Button><Button disabled={busy || !approval || Number(approvedAmount) <= 0} onClick={async () => { if (!approval) return; const ok = await call(`/api/admin/corporate/payments/${approval.id}`, { action: "APPROVE", approvedAmount: Number(approvedAmount) }, "PATCH", "Payment approved."); if (ok) setApproval(null); }}>Approve</Button></DialogFooter></Dialog>

      <Dialog open={recording !== null} onOpenChange={(open) => !open && setRecording(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>Capture the actual settlement details and proof link. Reconciliation remains a separate step.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="paid-amount">Paid amount ({dueItem.currency})</Label><Input id="paid-amount" type="number" min="0.01" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="paid-date">Payment date</Label><Input id="paid-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="paid-method">Method</Label><Input id="paid-method" list="corporate-payment-methods" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} /><datalist id="corporate-payment-methods">{PAYMENT_METHOD_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></div><div className="space-y-2"><Label htmlFor="paid-ref">Reference</Label><Input id="paid-ref" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="paid-proof">Payment proof URL</Label><Input id="paid-proof" type="url" value={paymentProofUrl} onChange={(e) => setPaymentProofUrl(e.target.value)} placeholder="https://…" /></div></div><DialogFooter><Button variant="outline" onClick={() => setRecording(null)}>Cancel</Button><Button disabled={busy || !recording || Number(paidAmount) <= 0 || !paymentDate || !paymentMethod} onClick={async () => { if (!recording) return; const ok = await call(`/api/admin/corporate/payments/${recording.id}`, { action: "RECORD_PAYMENT", paidAmount: Number(paidAmount), paymentDate, paymentMethod, paymentReference: paymentReference || null, paymentProofUrl: paymentProofUrl || null }, "PATCH", "Payment recorded."); if (ok) { setRecording(null); setPaymentReference(""); setPaymentProofUrl(""); } }}>Record</Button></DialogFooter></Dialog>
    </div>
  );
}

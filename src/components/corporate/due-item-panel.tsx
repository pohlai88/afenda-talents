"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaEvidenceList, type AfendaEvidenceItem } from "@/components/afenda/evidence-list";
import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { HistoricalPaymentRecorder } from "@/components/corporate/historical-payment-recorder";
import { PaymentWorkflow } from "@/components/corporate/payment-workflow";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import type { DueItemDto } from "@/components/corporate/workflow-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deriveDueState } from "@/lib/corporate-admin/domain";
import { DUE_ITEM_GUIDANCE } from "@/lib/corporate-admin/workflow-guidance";

export function DueItemPanel({ dueItem, dueFields, paymentFields, isAdmin }: {
  dueItem: DueItemDto;
  dueFields: CorporateCustomFieldDefinitionDto[];
  paymentFields: CorporateCustomFieldDefinitionDto[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(dueItem.periodLabel);
  const [dueDate, setDueDate] = useState(dueItem.dueDate);
  const [expectedAmount, setExpectedAmount] = useState(dueItem.expectedAmount == null ? "" : String(dueItem.expectedAmount));
  const [invoiceAmount, setInvoiceAmount] = useState(dueItem.invoiceAmount == null ? "" : String(dueItem.invoiceAmount));
  const [currency, setCurrency] = useState(dueItem.currency);
  const [invoiceRequired, setInvoiceRequired] = useState(dueItem.invoiceRequired);
  const [invoiceNumber, setInvoiceNumber] = useState(dueItem.invoiceNumber ?? "");
  const [invoiceFileUrl, setInvoiceFileUrl] = useState(dueItem.invoiceFileUrl ?? "");
  const [disputeFlag, setDisputeFlag] = useState(dueItem.disputeFlag);
  const [notes, setNotes] = useState(dueItem.notes ?? "");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(dueItem.customFields);
  const displayState = deriveDueState(dueItem.status, dueItem.dueDate, todayDateOnly());
  const recordedPayments = dueItem.payments.filter((payment) => payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID");
  const paidTotal = recordedPayments.reduce((sum, payment) => sum + (payment.paidAmount ?? 0), 0);
  const target = dueItem.invoiceAmount ?? dueItem.expectedAmount;
  const residual = target == null ? null : Math.max(0, target - paidTotal);
  const hasResidualAfterPayment = dueItem.status === "OPEN" && recordedPayments.length > 0 && residual != null && residual > 0.000001;
  const recordedPaymentsReconciled = recordedPayments.length > 0 && recordedPayments.every((payment) => Boolean(payment.reconciledAt));

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/due-items/${dueItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodLabel, dueDate, expectedAmount: expectedAmount === "" ? null : Number(expectedAmount), invoiceAmount: invoiceAmount === "" ? null : Number(invoiceAmount), currency, invoiceRequired, invoiceNumber: invoiceNumber || null, invoiceFileUrl: invoiceFileUrl || null, disputeFlag, notes: notes || null, customFields }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update due item");
      toast.success("Due item updated.");
      setEditOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update due item");
    } finally {
      setBusy(false);
    }
  }

  async function patchDue(action: "CANCEL" | "RESOLVE_BALANCE", reason: string, success: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/due-items/${dueItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update due item");
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update due item");
    } finally {
      setBusy(false);
    }
  }

  const evidence: AfendaEvidenceItem[] = [
    {
      label: "Invoice / supporting document",
      reference: dueItem.invoiceNumber,
      href: dueItem.invoiceFileUrl,
      required: dueItem.invoiceRequired,
      note: dueItem.invoiceRequired ? "Required for this due item." : "Optional supporting evidence for this occurrence.",
    },
    ...dueItem.payments
      .filter((payment) => payment.paymentProofUrl || payment.paymentReference)
      .map((payment, index) => ({
        label: `Payment evidence${dueItem.payments.length > 1 ? ` ${index + 1}` : ""}`,
        reference: payment.paymentReference,
        href: payment.paymentProofUrl,
        note: payment.paymentDate ? `Settlement recorded ${payment.paymentDate}.` : "Settlement evidence.",
      })),
  ];

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {dueItem.periodLabel}
            <CorporateStatusBadge status={displayState} />
            {dueItem.disputeFlag ? <CorporateStatusBadge status="DISPUTED" /> : null}
          </CardTitle>
          <CardDescription>Due {dueItem.dueDate} · {formatMoney(dueItem.currency, dueItem.invoiceAmount ?? dueItem.expectedAmount)}</CardDescription>
        </div>
        {isAdmin && dueItem.status !== "CANCELLED" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Update invoice / due</Button>
            {recordedPayments.length === 0 ? (
              <AfendaConfirmButton busy={busy} destructive title="Cancel or waive this due item?" description="Use this only when the charge is no longer valid or has been waived. Any un-settled payment request on this due item will also be cancelled. Update the due-item notes first if a specific waiver reason should be retained." confirmLabel="Cancel / waive due" onConfirm={() => patchDue("CANCEL", notes || "Cancelled / waived during administrative settlement.", "Due item cancelled / waived.")}>Cancel / waive</AfendaConfirmButton>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <AfendaMetadataGrid
          columns={3}
          items={[
            { label: "Invoice number", value: dueItem.invoiceNumber || "—" },
            { label: "Expected", value: formatMoney(dueItem.currency, dueItem.expectedAmount) },
            { label: "Invoice amount", value: formatMoney(dueItem.currency, dueItem.invoiceAmount) },
          ]}
          className="rounded-lg bg-muted/30 p-3"
        />
        <AfendaEvidenceList title="Due-item evidence" description="Invoice and settlement evidence attached to this occurrence." items={evidence} />
        {isAdmin && dueItem.status !== "CANCELLED" ? <div className="flex flex-wrap items-center gap-2"><HistoricalPaymentRecorder dueItem={dueItem} /><span className="text-xs text-muted-foreground">For already-paid legacy records; no new approval request is created.</span></div> : null}
        <PaymentWorkflow dueItem={dueItem} fields={paymentFields} isAdmin={isAdmin} />
        {isAdmin && hasResidualAfterPayment ? (
          <div className="rounded-lg border border-dashed p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Residual balance: {formatMoney(dueItem.currency, residual)}</p>
                <p className="mt-1 text-xs text-muted-foreground">If the remaining amount is waived, credited or otherwise resolved during final settlement, first reconcile every recorded payment, then use this action. The payment history remains intact; only the residual due is closed.</p>
              </div>
              <AfendaConfirmButton
                busy={busy}
                disabled={!recordedPaymentsReconciled}
                title="Resolve the remaining due balance?"
                description="Use this only after termination/final reconciliation has started and the residual balance has been formally waived, credited or adjusted. Recorded payments are preserved. Any un-settled payment request for the residual is cancelled."
                confirmLabel="Resolve remaining balance"
                onConfirm={() => patchDue("RESOLVE_BALANCE", notes || "Residual balance resolved through final settlement adjustment.", "Remaining balance resolved; due item completed.")}
              >
                Resolve remaining balance
              </AfendaConfirmButton>
            </div>
            {!recordedPaymentsReconciled ? <p className="mt-2 text-xs text-muted-foreground">Reconcile the recorded payment(s) before this control becomes available.</p> : null}
          </div>
        ) : null}
      </CardContent>

      <AfendaResponsiveOverlay
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Update due item"
        description="Add invoice evidence, adjust the expected amount, mark a dispute, or populate newly configured fields."
        contentClassName="sm:max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button>
            <Button disabled={busy || !dueDate || !periodLabel} onClick={() => void save()}>{busy ? "Saving…" : "Save due item"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AfendaField label="Period label" id={`period-${dueItem.id}`} required guidance={DUE_ITEM_GUIDANCE.periodLabel}><Input id={`period-${dueItem.id}`} value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} /></AfendaField>
          <AfendaField label="Due date" id={`due-${dueItem.id}`} required guidance={DUE_ITEM_GUIDANCE.dueDate}><Input id={`due-${dueItem.id}`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></AfendaField>
          <AfendaField label="Expected amount" id={`expected-${dueItem.id}`} guidance={DUE_ITEM_GUIDANCE.expectedAmount}><Input id={`expected-${dueItem.id}`} type="number" min="0" step="0.01" value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} /></AfendaField>
          <AfendaField label="Invoice amount" id={`invoice-amount-${dueItem.id}`} guidance={DUE_ITEM_GUIDANCE.invoiceAmount}><Input id={`invoice-amount-${dueItem.id}`} type="number" min="0" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></AfendaField>
          <AfendaField label="Currency" id={`currency-${dueItem.id}`} required guidance={DUE_ITEM_GUIDANCE.currency}><Input id={`currency-${dueItem.id}`} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></AfendaField>
          <AfendaField label="Invoice number" id={`invoice-number-${dueItem.id}`} guidance={DUE_ITEM_GUIDANCE.invoiceNumber}><Input id={`invoice-number-${dueItem.id}`} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></AfendaField>
          <AfendaField label="Invoice / supporting URL" id={`invoice-url-${dueItem.id}`} className="sm:col-span-2" guidance={DUE_ITEM_GUIDANCE.invoiceFileUrl}><Input id={`invoice-url-${dueItem.id}`} type="url" value={invoiceFileUrl} onChange={(e) => setInvoiceFileUrl(e.target.value)} /></AfendaField>
          <AfendaCheckField label="Invoice required" checked={invoiceRequired} onChange={setInvoiceRequired} guidance={DUE_ITEM_GUIDANCE.invoiceRequired} />
          <AfendaCheckField label="Dispute / uncertainty flag" checked={disputeFlag} onChange={setDisputeFlag} guidance={DUE_ITEM_GUIDANCE.disputeFlag} />
          <AfendaField label="Notes" id={`due-notes-${dueItem.id}`} className="sm:col-span-2" guidance={DUE_ITEM_GUIDANCE.notes}><Textarea id={`due-notes-${dueItem.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} /></AfendaField>
          <div className="sm:col-span-2"><CustomFieldControls definitions={dueFields} values={customFields} onChange={setCustomFields} /></div>
        </div>
      </AfendaResponsiveOverlay>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { PaymentWorkflow } from "@/components/corporate/payment-workflow";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import type { DueItemDto } from "@/components/corporate/workflow-types";
import { deriveDueState } from "@/lib/corporate-admin/domain";

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

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle className="flex flex-wrap items-center gap-2">{dueItem.periodLabel}<CorporateStatusBadge status={displayState} />{dueItem.disputeFlag ? <CorporateStatusBadge status="DISPUTED" /> : null}</CardTitle><CardDescription>Due {dueItem.dueDate} · {formatMoney(dueItem.currency, dueItem.invoiceAmount ?? dueItem.expectedAmount)}</CardDescription></div>
        {isAdmin && dueItem.status !== "CANCELLED" ? <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Update invoice / due</Button> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-3"><p><span className="text-muted-foreground">Invoice </span>{dueItem.invoiceNumber || "—"}</p><p><span className="text-muted-foreground">Expected </span>{formatMoney(dueItem.currency, dueItem.expectedAmount)}</p><p><span className="text-muted-foreground">Invoice amount </span>{formatMoney(dueItem.currency, dueItem.invoiceAmount)}</p></div>
        <PaymentWorkflow dueItem={dueItem} fields={paymentFields} isAdmin={isAdmin} />
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Update due item</DialogTitle><DialogDescription>Add invoice evidence, adjust the expected amount, mark a dispute, or populate newly configured fields.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Period label" id={`period-${dueItem.id}`}><Input id={`period-${dueItem.id}`} value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} /></Field>
            <Field label="Due date" id={`due-${dueItem.id}`}><Input id={`due-${dueItem.id}`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            <Field label="Expected amount" id={`expected-${dueItem.id}`}><Input id={`expected-${dueItem.id}`} type="number" min="0" step="0.01" value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} /></Field>
            <Field label="Invoice amount" id={`invoice-amount-${dueItem.id}`}><Input id={`invoice-amount-${dueItem.id}`} type="number" min="0" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></Field>
            <Field label="Currency" id={`currency-${dueItem.id}`}><Input id={`currency-${dueItem.id}`} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></Field>
            <Field label="Invoice number" id={`invoice-number-${dueItem.id}`}><Input id={`invoice-number-${dueItem.id}`} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
            <Field label="Invoice / supporting URL" id={`invoice-url-${dueItem.id}`} className="sm:col-span-2"><Input id={`invoice-url-${dueItem.id}`} type="url" value={invoiceFileUrl} onChange={(e) => setInvoiceFileUrl(e.target.value)} /></Field>
            <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"><Checkbox checked={invoiceRequired} onCheckedChange={(v) => setInvoiceRequired(v === true)} />Invoice required</label>
            <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"><Checkbox checked={disputeFlag} onCheckedChange={(v) => setDisputeFlag(v === true)} />Dispute / uncertainty flag</label>
            <Field label="Notes" id={`due-notes-${dueItem.id}`} className="sm:col-span-2"><Textarea id={`due-notes-${dueItem.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="sm:col-span-2"><CustomFieldControls definitions={dueFields} values={customFields} onChange={setCustomFields} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={busy || !dueDate || !periodLabel} onClick={() => void save()}>{busy ? "Saving…" : "Save due item"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, id, children, className = "" }: { label: string; id: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

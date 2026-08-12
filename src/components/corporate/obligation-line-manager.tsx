"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { AfendaSection } from "@/components/afenda/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/components/corporate/status";
import { OBLIGATION_LINE_TYPE_SUGGESTIONS } from "@/lib/corporate-admin/obligation-lines";

export type ObligationLineRow = {
  id: string; code: string; name: string; lineType: string; expectedAmount: number | null; currency: string;
  recurring: boolean; recurrenceInterval: number | null; recurrenceUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" | null;
  nextDueDate: string | null; invoiceRequired: boolean; isActive: boolean; dueCount: number;
};

const EMPTY = { code: "", name: "", lineType: "GENERAL", expectedAmount: "", currency: "MYR", recurring: false, recurrenceInterval: "1", recurrenceUnit: "MONTH" as const, firstDueDate: "", invoiceRequired: false, paymentTermsDays: "", startDate: "", endDate: "", notes: "" };

export function ObligationLineManager({ obligationId, obligationStatus, lines, isAdmin }: { obligationId: string; obligationStatus: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED"; lines: ObligationLineRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const canAdd = isAdmin && obligationStatus !== "ENDED" && obligationStatus !== "CANCELLED";

  async function addLine() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: draft.code, name: draft.name, lineType: draft.lineType, expectedAmount: draft.expectedAmount === "" ? null : Number(draft.expectedAmount), currency: draft.currency, recurring: draft.recurring, recurrenceInterval: draft.recurring ? Number(draft.recurrenceInterval) : null, recurrenceUnit: draft.recurring ? draft.recurrenceUnit : null, firstDueDate: draft.firstDueDate || null, nextDueDate: draft.firstDueDate || null, invoiceRequired: draft.invoiceRequired, paymentTermsDays: draft.paymentTermsDays === "" ? null : Number(draft.paymentTermsDays), startDate: draft.startDate || null, endDate: draft.endDate || null, notes: draft.notes || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not add line");
      toast.success("Obligation line added."); setDraft(EMPTY); setOpen(false); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add line"); }
    finally { setBusy(false); }
  }

  async function generateNext(line: ObligationLineRow) {
    setGeneratingId(line.id);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/due-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "NEXT", lineId: line.id, customFields: {} }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not generate due item");
      toast.success(`${line.name}: next due item generated.`); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not generate due item"); }
    finally { setGeneratingId(null); }
  }

  async function setLineActive(line: ObligationLineRow, isActive: boolean) {
    setUpdatingId(line.id);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/lines/${line.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SET_ACTIVE", isActive }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update line");
      toast.success(isActive ? "Agreement line reactivated." : "Agreement line deactivated."); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update line"); }
    finally { setUpdatingId(null); }
  }

  return <>
    <AfendaSection title="Agreement lines & schedules" description="Split one agreement into the components that are actually charged or scheduled—such as rent, service charge, parking, deposits or annual fees. Each line keeps its own amount and recurrence pointer." actions={canAdd ? <Button type="button" variant="outline" onClick={() => setOpen(true)}>Add line</Button> : undefined}>
      <div className="grid gap-3 lg:grid-cols-2">
        {lines.map((line) => <Card key={line.id} className={!line.isActive ? "opacity-70" : undefined}>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle className="flex flex-wrap items-center gap-2 text-base">{line.name}<span className="font-mono text-xs font-normal text-muted-foreground">{line.code}</span></CardTitle><CardDescription>{line.lineType.replaceAll("_", " ").toLowerCase()} · {line.isActive ? "active" : "inactive"}</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && obligationStatus === "ACTIVE" && line.isActive && line.recurring && line.nextDueDate ? <Button type="button" size="sm" disabled={generatingId === line.id} onClick={() => void generateNext(line)}>{generatingId === line.id ? "Generating…" : "Generate next"}</Button> : null}
              {isAdmin && line.code !== "GENERAL" ? (line.isActive ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate agreement line?" description="The line stays in history but cannot generate new due items until reactivated." confirmLabel="Deactivate" onConfirm={() => setLineActive(line, false)} busy={updatingId === line.id}>Deactivate</AfendaConfirmButton> : <Button type="button" size="sm" variant="outline" disabled={updatingId === line.id} onClick={() => void setLineActive(line, true)}>Reactivate</Button>) : null}
            </div>
          </CardHeader>
          <CardContent><AfendaMetadataGrid columns={3} items={[{ label: "Expected", value: formatMoney(line.currency, line.expectedAmount) },{ label: "Schedule", value: line.recurring && line.recurrenceInterval && line.recurrenceUnit ? `Every ${line.recurrenceInterval} ${line.recurrenceUnit.toLowerCase()}${line.recurrenceInterval === 1 ? "" : "s"}` : "One-off / manual" },{ label: "Next due", value: line.nextDueDate ?? "—" },{ label: "Invoice", value: line.invoiceRequired ? "Required" : "Optional" },{ label: "Due items", value: String(line.dueCount) },{ label: "Currency", value: line.currency }]} /></CardContent>
        </Card>)}
      </div>
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add agreement line" description="Create a separate payable or scheduled component beneath this obligation. Business line types remain configurable rather than hard-coded lifecycle enums." contentClassName="sm:max-w-2xl" footer={<><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" disabled={busy || !draft.code.trim() || !draft.name.trim() || !draft.currency.trim()} onClick={() => void addLine()}>{busy ? "Adding…" : "Add line"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AfendaField label="Line code" id="line-code" required description="Stable code within this obligation, for example RENT or SERVICE_CHARGE."><Input id="line-code" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "_") }))} placeholder="RENT" /></AfendaField>
        <AfendaField label="Line name" id="line-name" required description="Human-readable commercial component."><Input id="line-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Monthly rent" /></AfendaField>
        <AfendaField label="Line type" id="line-type" required description="Configurable taxonomy used for filtering and reporting."><Input id="line-type" list="obligation-line-types" value={draft.lineType} onChange={(event) => setDraft((current) => ({ ...current, lineType: event.target.value.toUpperCase() }))} /><datalist id="obligation-line-types">{OBLIGATION_LINE_TYPE_SUGGESTIONS.map((type) => <option key={type} value={type} />)}</datalist></AfendaField>
        <AfendaField label="Currency" id="line-currency" required><Input id="line-currency" maxLength={3} value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></AfendaField>
        <AfendaField label="Expected amount" id="line-amount" description="Expected amount for this line; actual invoice/payment can differ."><Input id="line-amount" type="number" min="0" step="0.01" value={draft.expectedAmount} onChange={(event) => setDraft((current) => ({ ...current, expectedAmount: event.target.value }))} /></AfendaField>
        <AfendaField label="Payment terms (days)" id="line-payment-terms"><Input id="line-payment-terms" type="number" min="0" step="1" value={draft.paymentTermsDays} onChange={(event) => setDraft((current) => ({ ...current, paymentTermsDays: event.target.value }))} /></AfendaField>
        <AfendaCheckField label="Recurring line" checked={draft.recurring} onChange={(recurring) => setDraft((current) => ({ ...current, recurring }))} description="Enable when this component repeats on its own schedule." />
        <AfendaCheckField label="Invoice required" checked={draft.invoiceRequired} onChange={(invoiceRequired) => setDraft((current) => ({ ...current, invoiceRequired }))} description="Require invoice/supporting evidence on generated due items." />
        {draft.recurring ? <><AfendaField label="Every" id="line-interval" required><Input id="line-interval" type="number" min="1" max="120" value={draft.recurrenceInterval} onChange={(event) => setDraft((current) => ({ ...current, recurrenceInterval: event.target.value }))} /></AfendaField><AfendaField label="Recurrence unit" id="line-unit" required><Select value={draft.recurrenceUnit} onValueChange={(value) => setDraft((current) => ({ ...current, recurrenceUnit: value as typeof current.recurrenceUnit }))}><SelectTrigger id="line-unit" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["DAY", "WEEK", "MONTH", "YEAR"].map((unit) => <SelectItem key={unit} value={unit}>{unit.toLowerCase()}</SelectItem>)}</SelectGroup></SelectContent></Select></AfendaField><AfendaField label="First / next due date" id="line-first-due" required className="sm:col-span-2"><Input id="line-first-due" type="date" value={draft.firstDueDate} onChange={(event) => setDraft((current) => ({ ...current, firstDueDate: event.target.value }))} /></AfendaField></> : null}
        <AfendaField label="Line starts" id="line-start"><Input id="line-start" type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></AfendaField>
        <AfendaField label="Line ends" id="line-end"><Input id="line-end" type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></AfendaField>
        <AfendaField label="Notes" id="line-notes" className="sm:col-span-2"><Textarea id="line-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>
  </>;
}

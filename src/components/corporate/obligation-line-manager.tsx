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
import { formatMoney, corporateStatusLabel } from "@/components/corporate/status";
import { defaultPeriodLabel } from "@/lib/corporate-admin/domain";
import { OBLIGATION_LINE_TYPE_SUGGESTIONS, suggestPeriodLabel } from "@/lib/corporate-admin/obligation-lines";

export type ObligationLineRow = {
  id: string;
  code: string;
  name: string;
  lineType: string;
  expectedAmount: number | null;
  currency: string;
  recurring: boolean;
  recurrenceInterval: number | null;
  recurrenceUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" | null;
  firstDueDate: string | null;
  nextDueDate: string | null;
  invoiceRequired: boolean;
  paymentTermsDays: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  isActive: boolean;
  dueCount: number;
  dueItems: { dueDate: string; periodLabel: string }[];
};

type LineDraft = {
  code: string;
  name: string;
  lineType: string;
  expectedAmount: string;
  currency: string;
  recurring: boolean;
  recurrenceInterval: string;
  recurrenceUnit: "DAY" | "WEEK" | "MONTH" | "YEAR";
  firstDueDate: string;
  nextDueDate: string;
  invoiceRequired: boolean;
  paymentTermsDays: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const EMPTY: LineDraft = {
  code: "",
  name: "",
  lineType: "GENERAL",
  expectedAmount: "",
  currency: "MYR",
  recurring: false,
  recurrenceInterval: "1",
  recurrenceUnit: "MONTH",
  firstDueDate: "",
  nextDueDate: "",
  invoiceRequired: false,
  paymentTermsDays: "",
  startDate: "",
  endDate: "",
  notes: "",
};

function lineDraft(line: ObligationLineRow): LineDraft {
  return {
    code: line.code,
    name: line.name,
    lineType: line.lineType,
    expectedAmount: line.expectedAmount == null ? "" : String(line.expectedAmount),
    currency: line.currency,
    recurring: line.recurring,
    recurrenceInterval: line.recurrenceInterval == null ? "1" : String(line.recurrenceInterval),
    recurrenceUnit: line.recurrenceUnit ?? "MONTH",
    firstDueDate: line.firstDueDate ?? "",
    nextDueDate: line.nextDueDate ?? "",
    invoiceRequired: line.invoiceRequired,
    paymentTermsDays: line.paymentTermsDays == null ? "" : String(line.paymentTermsDays),
    startDate: line.startDate ?? "",
    endDate: line.endDate ?? "",
    notes: line.notes ?? "",
  };
}

export function ObligationLineManager({
  obligationId,
  obligationStatus,
  lines,
  isAdmin,
}: {
  obligationId: string;
  obligationStatus: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED";
  lines: ObligationLineRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editLine, setEditLine] = useState<ObligationLineRow | null>(null);
  const [manualLine, setManualLine] = useState<ObligationLineRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LineDraft>(EMPTY);
  const [manualDueDate, setManualDueDate] = useState("");
  const [manualPeriod, setManualPeriod] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const canAdd = isAdmin && obligationStatus !== "ENDED" && obligationStatus !== "CANCELLED";
  const clashingLabels = manualLine && manualDueDate
    ? manualLine.dueItems.filter((due) => due.dueDate === manualDueDate).map((due) => due.periodLabel)
    : [];

  function payloadFromDraft(source: LineDraft) {
    return {
      name: source.name,
      lineType: source.lineType,
      expectedAmount: source.expectedAmount === "" ? null : Number(source.expectedAmount),
      currency: source.currency,
      recurring: source.recurring,
      recurrenceInterval: source.recurring ? Number(source.recurrenceInterval) : null,
      recurrenceUnit: source.recurring ? source.recurrenceUnit : null,
      firstDueDate: source.recurring ? source.firstDueDate || null : null,
      nextDueDate: source.recurring ? source.nextDueDate || source.firstDueDate || null : null,
      invoiceRequired: source.invoiceRequired,
      paymentTermsDays: source.paymentTermsDays === "" ? null : Number(source.paymentTermsDays),
      startDate: source.startDate || null,
      endDate: source.endDate || null,
      notes: source.notes || null,
    };
  }

  async function addLine() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: draft.code, ...payloadFromDraft(draft) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not add line");
      toast.success("Agreement line added.");
      setDraft(EMPTY);
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add line");
    } finally { setBusy(false); }
  }

  async function saveLine() {
    if (!editLine) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/lines/${editLine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", ...payloadFromDraft(draft) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update line");
      toast.success("Agreement line updated.");
      setEditLine(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update line");
    } finally { setBusy(false); }
  }

  async function generateNext(line: ObligationLineRow) {
    setGeneratingId(line.id);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/due-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "NEXT", lineId: line.id, customFields: {} }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not generate due item");
      toast.success(`${line.name}: next due item generated.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate due item");
    } finally { setGeneratingId(null); }
  }

  async function addManualDue() {
    if (!manualLine) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/due-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "MANUAL",
          lineId: manualLine.id,
          dueDate: manualDueDate,
          periodLabel: manualPeriod || undefined,
          expectedAmount: manualAmount === "" ? manualLine.expectedAmount : Number(manualAmount),
          currency: manualLine.currency,
          invoiceRequired: manualLine.invoiceRequired,
          customFields: {},
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not add manual due");
      toast.success(`${manualLine.name}: manual due item added.`);
      setManualLine(null);
      setManualDueDate("");
      setManualPeriod("");
      setManualAmount("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add manual due");
    } finally { setBusy(false); }
  }

  async function setLineActive(line: ObligationLineRow, isActive: boolean) {
    setUpdatingId(line.id);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update line");
      toast.success(isActive ? "Agreement line reactivated." : "Agreement line deactivated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update line");
    } finally { setUpdatingId(null); }
  }

  function openCreate() {
    setDraft(EMPTY);
    setCreateOpen(true);
  }

  function openEdit(line: ObligationLineRow) {
    setDraft(lineDraft(line));
    setEditLine(line);
  }

  function openManual(line: ObligationLineRow) {
    setManualLine(line);
    setManualAmount(line.expectedAmount == null ? "" : String(line.expectedAmount));
    setManualPeriod("");
    setManualDueDate("");
  }

  const editor = (
    <div className="grid gap-4 sm:grid-cols-2">
      {!editLine ? <AfendaField label="Line code" id="line-code" required description="Stable code within this obligation, for example RENT or SERVICE_CHARGE."><Input id="line-code" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "_") }))} placeholder="RENT" /></AfendaField> : null}
      <AfendaField label="Line name" id="line-name" required description="Human-readable commercial component."><Input id="line-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Monthly rent" /></AfendaField>
      <AfendaField label="Line type" id="line-type" required description="Configurable taxonomy used for filtering and reporting."><Input id="line-type" list="obligation-line-types" value={draft.lineType} onChange={(event) => setDraft((current) => ({ ...current, lineType: event.target.value.toUpperCase() }))} /><datalist id="obligation-line-types">{OBLIGATION_LINE_TYPE_SUGGESTIONS.map((type) => <option key={type} value={type} />)}</datalist></AfendaField>
      <AfendaField label="Currency" id="line-currency" required><Input id="line-currency" maxLength={3} value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></AfendaField>
      <AfendaField label="Expected amount" id="line-amount" description="Expected amount for this line; actual invoice/payment can differ."><Input id="line-amount" type="number" min="0" step="0.01" value={draft.expectedAmount} onChange={(event) => setDraft((current) => ({ ...current, expectedAmount: event.target.value }))} /></AfendaField>
      <AfendaField label="Payment terms (days)" id="line-payment-terms"><Input id="line-payment-terms" type="number" min="0" step="1" value={draft.paymentTermsDays} onChange={(event) => setDraft((current) => ({ ...current, paymentTermsDays: event.target.value }))} /></AfendaField>
      <AfendaCheckField label="Recurring line" checked={draft.recurring} onChange={(recurring) => setDraft((current) => ({ ...current, recurring }))} description="Enable when this component repeats on its own schedule." />
      <AfendaCheckField label="Invoice required" checked={draft.invoiceRequired} onChange={(invoiceRequired) => setDraft((current) => ({ ...current, invoiceRequired }))} description="Require invoice/supporting evidence on generated due items." />
      {draft.recurring ? <>
        <AfendaField label="Every" id="line-interval" required><Input id="line-interval" type="number" min="1" max="120" value={draft.recurrenceInterval} onChange={(event) => setDraft((current) => ({ ...current, recurrenceInterval: event.target.value }))} /></AfendaField>
        <AfendaField label="Recurrence unit" id="line-unit" required><Select value={draft.recurrenceUnit} onValueChange={(value) => setDraft((current) => ({ ...current, recurrenceUnit: value as LineDraft["recurrenceUnit"] }))}><SelectTrigger id="line-unit" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["DAY", "WEEK", "MONTH", "YEAR"].map((unit) => <SelectItem key={unit} value={unit}>{unit.toLowerCase()}</SelectItem>)}</SelectGroup></SelectContent></Select></AfendaField>
        <AfendaField label="First due date" id="line-first-due"><Input id="line-first-due" type="date" value={draft.firstDueDate} onChange={(event) => setDraft((current) => ({ ...current, firstDueDate: event.target.value }))} /></AfendaField>
        <AfendaField label="Next due date" id="line-next-due" required><Input id="line-next-due" type="date" value={draft.nextDueDate} onChange={(event) => setDraft((current) => ({ ...current, nextDueDate: event.target.value }))} /></AfendaField>
      </> : null}
      <AfendaField label="Line starts" id="line-start"><Input id="line-start" type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></AfendaField>
      <AfendaField label="Line ends" id="line-end"><Input id="line-end" type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></AfendaField>
      <AfendaField label="Notes" id="line-notes" className="sm:col-span-2"><Textarea id="line-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></AfendaField>
    </div>
  );

  return <>
    <AfendaSection
      title="Agreement lines & schedules"
      description="Split one agreement into the components that are actually charged or scheduled—such as rent, service charge, parking, deposits or annual fees. Each line keeps its own amount and recurrence pointer."
      actions={canAdd ? <Button type="button" variant="outline" onClick={openCreate}>Add line</Button> : undefined}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {lines.map((line) => <Card key={line.id} className={!line.isActive ? "opacity-70" : undefined}>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">{line.name}<span className="font-mono text-xs font-normal text-muted-foreground">{line.code}</span></CardTitle>
              <CardDescription>{corporateStatusLabel(line.lineType)} · {line.isActive ? "active" : "inactive"}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && line.isActive ? <Button type="button" size="sm" variant="outline" onClick={() => openEdit(line)}>Edit terms</Button> : null}
              {isAdmin && obligationStatus === "ACTIVE" && line.isActive ? <Button type="button" size="sm" variant="outline" onClick={() => openManual(line)}>Add manual due</Button> : null}
              {isAdmin && obligationStatus === "ACTIVE" && line.isActive && line.recurring && line.nextDueDate ? <Button type="button" size="sm" disabled={generatingId === line.id} onClick={() => void generateNext(line)}>{generatingId === line.id ? "Generating…" : "Generate next"}</Button> : null}
              {isAdmin && line.code !== "GENERAL" ? (line.isActive ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate agreement line?" description="The line stays in history but cannot generate new due items until reactivated." confirmLabel="Deactivate" onConfirm={() => setLineActive(line, false)} busy={updatingId === line.id}>Deactivate</AfendaConfirmButton> : <Button type="button" size="sm" variant="outline" disabled={updatingId === line.id} onClick={() => void setLineActive(line, true)}>Reactivate</Button>) : null}
            </div>
          </CardHeader>
          <CardContent><AfendaMetadataGrid columns={3} items={[
            { label: "Expected", value: formatMoney(line.currency, line.expectedAmount) },
            { label: "Schedule", value: line.recurring && line.recurrenceInterval && line.recurrenceUnit ? `Every ${line.recurrenceInterval} ${line.recurrenceUnit.toLowerCase()}${line.recurrenceInterval === 1 ? "" : "s"}` : "One-off / manual" },
            { label: "Next due", value: line.nextDueDate ?? "—" },
            { label: "Invoice", value: line.invoiceRequired ? "Required" : "Optional" },
            { label: "Due items", value: String(line.dueCount) },
            { label: "Payment terms", value: line.paymentTermsDays == null ? "—" : `${line.paymentTermsDays} days` },
          ]} /></CardContent>
        </Card>)}
      </div>
    </AfendaSection>

    <AfendaResponsiveOverlay open={createOpen} onOpenChange={setCreateOpen} title="Add agreement line" description="Create a separate payable or scheduled component beneath this obligation. Business line types remain configurable rather than hard-coded lifecycle enums." contentClassName="sm:max-w-2xl" footer={<><Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="button" disabled={busy || !draft.code.trim() || !draft.name.trim() || !draft.currency.trim()} onClick={() => void addLine()}>{busy ? "Adding…" : "Add line"}</Button></>}>
      {editor}
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={editLine !== null} onOpenChange={(open) => !open && setEditLine(null)} title={editLine ? `Edit ${editLine.name}` : "Edit agreement line"} description="Change the commercial and scheduling terms for future occurrences. Existing due items keep their recorded history." contentClassName="sm:max-w-2xl" footer={<><Button type="button" variant="outline" disabled={busy} onClick={() => setEditLine(null)}>Cancel</Button><Button type="button" disabled={busy || !draft.name.trim() || !draft.currency.trim()} onClick={() => void saveLine()}>{busy ? "Saving…" : "Save line"}</Button></>}>
      {editor}
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={manualLine !== null} onOpenChange={(open) => !open && setManualLine(null)} title={manualLine ? `Add manual due · ${manualLine.name}` : "Add manual due"} description="Add an exceptional or one-off occurrence to this specific agreement line without advancing its recurrence pointer." contentClassName="sm:max-w-xl" footer={<><Button type="button" variant="outline" disabled={busy} onClick={() => setManualLine(null)}>Cancel</Button><Button type="button" disabled={busy || !manualDueDate} onClick={() => void addManualDue()}>{busy ? "Adding…" : "Add due item"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AfendaField label="Due date" id="line-manual-due" required><Input id="line-manual-due" type="date" value={manualDueDate} onChange={(event) => {
          const nextDate = event.target.value;
          setManualDueDate(nextDate);
          const taken = manualLine
            ? manualLine.dueItems.filter((due) => due.dueDate === nextDate).map((due) => due.periodLabel)
            : [];
          setManualPeriod(taken.length === 0 ? "" : suggestPeriodLabel(defaultPeriodLabel(nextDate), taken));
        }} /></AfendaField>
        {clashingLabels.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {clashingLabels.length} already on this date: {clashingLabels.join(", ")}. Keep the suggested period label to add a second item to this line, or cancel and add a separate agreement line if this is a different charge.
          </p>
        ) : null}
        <AfendaField label="Period label" id="line-manual-period"><Input id="line-manual-period" value={manualPeriod} onChange={(event) => setManualPeriod(event.target.value)} placeholder="Deposit or 2026-08" /></AfendaField>
        <AfendaField label={`Expected amount (${manualLine?.currency ?? ""})`} id="line-manual-amount" className="sm:col-span-2"><Input id="line-manual-amount" type="number" min="0" step="0.01" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>
  </>;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import type { OperationsGridRow, OperationsMatrixRow } from "@/components/corporate/operations-console";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { corporateStatusLabel } from "@/components/corporate/status";

const COLUMN_KEY = "afenda-corporate-operations-columns";

type ColumnKey = "sites" | "counterparty" | "nextDue" | "expected" | "open";
const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = { sites: true, counterparty: true, nextDue: true, expected: true, open: true };

function money(currency: string, value: number | null): string {
  if (value == null) return "";
  try { return new Intl.NumberFormat("en-MY", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value}`; }
}

export function SpreadsheetOperationsGrid({ rows, sites, isAdmin }: {
  rows: OperationsGridRow[];
  sites: Pick<OperationsMatrixRow, "siteId" | "siteCode" | "siteName">[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnOpen, setColumnOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [scopeRole, setScopeRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: "expectedAmount" | "nextDueDate" } | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(COLUMN_KEY);
        if (raw) setColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(raw) as Partial<Record<ColumnKey, boolean>> });
      } catch { /* retain defaults */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function persistColumns(next: Record<ColumnKey, boolean>) {
    setColumns(next);
    try { window.localStorage.setItem(COLUMN_KEY, JSON.stringify(next)); } catch { /* device preference only */ }
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function bulk(body: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/operations/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Bulk operation failed");
      toast.success(success);
      setSelected(new Set());
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Bulk operation failed"); }
    finally { setBusy(false); }
  }

  async function saveCell(row: OperationsGridRow) {
    if (!editing || editing.id !== row.id) return;
    const body = editing.field === "expectedAmount"
      ? { action: "UPDATE", expectedAmount: editValue.trim() === "" ? null : Number(editValue) }
      : { action: "UPDATE", nextDueDate: editValue.trim() === "" ? null : editValue };
    setEditing(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${row.obligationId}/lines/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update line");
      toast.success(`${row.lineName} updated.`);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update line"); }
    finally { setBusy(false); }
  }

  async function copySelected() {
    if (selectedRows.length === 0) return;
    const header = ["Agreement", "Agreement code", "Line", "Line code", "Sites", "Counterparty", "Next due", "Expected", "Currency", "Open dues", "Overdue dues"];
    const records = selectedRows.map((row) => [row.obligationTitle, row.obligationCode, row.lineName, row.lineCode, row.sites.join(", "), row.counterparty, row.nextDueDate ?? "", row.expectedAmount ?? "", row.currency, row.openDueCount, row.overdueDueCount]);
    const tsv = [header, ...records].map((record) => record.map((value) => String(value).replaceAll("\t", " ").replaceAll("\n", " ")).join("\t")).join("\n");
    try { await navigator.clipboard.writeText(tsv); toast.success(`${selectedRows.length} row${selectedRows.length === 1 ? "" : "s"} copied for Excel / Sheets.`); }
    catch { toast.error("Clipboard access was unavailable."); }
  }

  const selectedObligationIds = Array.from(new Set(selectedRows.map((row) => row.obligationId)));

  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{selected.size} selected</span>
        <Button size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={() => void copySelected()}>Copy TSV</Button>
        <Button size="sm" variant="outline" onClick={() => setColumnOpen(true)}>Columns</Button>
      </div>
      {isAdmin && selectedRows.length > 0 ? <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setSiteOpen(true)}>Link Site</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk({ action: "SET_LINE_ACTIVE", lineIds: selectedRows.map((row) => row.id), isActive: true }, "Selected agreement lines activated.")}>Activate</Button>
        <AfendaConfirmButton size="sm" variant="outline" busy={busy} title="Deactivate selected agreement lines?" description="Selected non-GENERAL lines stay in history but cannot generate new dues until reactivated. Any GENERAL line in the selection will block the whole bulk action." confirmLabel="Deactivate selected" onConfirm={() => bulk({ action: "SET_LINE_ACTIVE", lineIds: selectedRows.map((row) => row.id), isActive: false }, "Selected agreement lines deactivated.")}>Deactivate</AfendaConfirmButton>
      </div> : null}
    </div>

    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-10"><Checkbox aria-label="Select all visible operation rows" checked={allSelected} onCheckedChange={(checked) => setSelected(checked === true ? new Set(rows.map((row) => row.id)) : new Set())} /></TableHead>
          <TableHead>Agreement</TableHead><TableHead>Line</TableHead>
          {columns.sites ? <TableHead>Sites</TableHead> : null}
          {columns.counterparty ? <TableHead>Counterparty</TableHead> : null}
          {columns.nextDue ? <TableHead>Next due</TableHead> : null}
          {columns.expected ? <TableHead>Expected</TableHead> : null}
          {columns.open ? <TableHead className="text-right">Open / overdue</TableHead> : null}
        </TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
          <TableCell><Checkbox aria-label={`Select ${row.obligationCode} ${row.lineCode}`} checked={selected.has(row.id)} onCheckedChange={(checked) => toggleRow(row.id, checked === true)} /></TableCell>
          <TableCell><Link href={`/admin/corporate/obligations/${row.obligationId}`} className="font-medium hover:underline">{row.obligationTitle}</Link><span className="block font-mono text-xs text-muted-foreground">{row.obligationCode} · {row.obligationStatus}</span></TableCell>
          <TableCell><Link href={`/admin/corporate/obligations/${row.obligationId}/lines`} className="font-medium hover:underline">{row.lineName}</Link><span className="block font-mono text-xs text-muted-foreground">{row.lineCode} · {corporateStatusLabel(row.lineType)}{row.lineActive ? "" : " · INACTIVE"}</span></TableCell>
          {columns.sites ? <TableCell className="max-w-56"><span className="line-clamp-2">{row.sites.length > 0 ? row.sites.join(", ") : "—"}</span></TableCell> : null}
          {columns.counterparty ? <TableCell>{row.counterparty}</TableCell> : null}
          {columns.nextDue ? <TableCell className="min-w-36">{isAdmin && row.lineActive ? (editing?.id === row.id && editing.field === "nextDueDate" ? <Input autoFocus type="date" value={editValue} onChange={(event) => setEditValue(event.target.value)} onBlur={() => void saveCell(row)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditing(null); }} aria-label={`Next due date for ${row.lineName}`} /> : <button type="button" className="min-h-8 rounded px-2 font-mono text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setEditing({ id: row.id, field: "nextDueDate" }); setEditValue(row.nextDueDate ?? ""); }}>{row.nextDueDate ?? "Set date"}</button>) : <span className="font-mono text-xs">{row.nextDueDate ?? "—"}</span>}</TableCell> : null}
          {columns.expected ? <TableCell className="min-w-40">{isAdmin && row.lineActive ? (editing?.id === row.id && editing.field === "expectedAmount" ? <Input autoFocus type="number" min="0" step="0.01" value={editValue} onChange={(event) => setEditValue(event.target.value)} onBlur={() => void saveCell(row)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditing(null); }} aria-label={`Expected amount for ${row.lineName}`} /> : <button type="button" className="min-h-8 rounded px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setEditing({ id: row.id, field: "expectedAmount" }); setEditValue(row.expectedAmount == null ? "" : String(row.expectedAmount)); }}>{money(row.currency, row.expectedAmount) || "Set amount"}</button>) : <span>{money(row.currency, row.expectedAmount) || "—"}</span>}</TableCell> : null}
          {columns.open ? <TableCell className="text-right tabular-nums"><span className={row.overdueDueCount > 0 ? "font-semibold" : undefined}>{row.openDueCount} / {row.overdueDueCount}</span></TableCell> : null}
        </TableRow>)}</TableBody>
      </Table>
    </div>

    <AfendaResponsiveOverlay open={columnOpen} onOpenChange={setColumnOpen} title="Choose operations columns" description="Column visibility is stored on this device so each operator can keep the grid as dense or focused as they need." footer={<Button onClick={() => setColumnOpen(false)}>Done</Button>}>
      <div className="flex flex-col gap-3">{([['sites','Sites'],['counterparty','Counterparty'],['nextDue','Next due'],['expected','Expected amount'],['open','Open / overdue']] as [ColumnKey,string][]).map(([key,label]) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-lg border px-3"><Checkbox checked={columns[key]} onCheckedChange={(checked) => persistColumns({ ...columns, [key]: checked === true })} />{label}</label>)}</div>
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={siteOpen} onOpenChange={setSiteOpen} title="Link selected agreements to Site" description={`This will link ${selectedObligationIds.length} unique agreement${selectedObligationIds.length === 1 ? "" : "s"}. Existing links are updated safely rather than duplicated.`} footer={<><Button variant="outline" disabled={busy} onClick={() => setSiteOpen(false)}>Cancel</Button><Button disabled={busy || !siteId} onClick={async () => { await bulk({ action: "LINK_SITE", obligationIds: selectedObligationIds, siteId, scopeRole: scopeRole || null }, "Selected agreements linked to Site."); setSiteOpen(false); }}>Link Site</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><label htmlFor="bulk-site" className="text-sm font-medium">Site</label><Select value={siteId} onValueChange={setSiteId}><SelectTrigger id="bulk-site" className="w-full"><SelectValue placeholder="Choose Site" /></SelectTrigger><SelectContent><SelectGroup>{sites.map((site) => <SelectItem key={site.siteId} value={site.siteId}>{site.siteName} · {site.siteCode}</SelectItem>)}</SelectGroup></SelectContent></Select></div>
        <div className="flex flex-col gap-2"><label htmlFor="bulk-site-role" className="text-sm font-medium">Scope role</label><Input id="bulk-site-role" value={scopeRole} onChange={(event) => setScopeRole(event.target.value)} placeholder="Premises, service location, covered site…" /></div>
      </div>
    </AfendaResponsiveOverlay>
  </div>;
}

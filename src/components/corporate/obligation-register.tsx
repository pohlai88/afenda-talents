"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import { CorporateStatusBadge, formatMoney } from "@/components/corporate/status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ObligationRegisterField = { id: string; key: string; label: string };
export type ObligationRegisterRow = {
  id: string; code: string; title: string; organization: string; category: string; counterpartyName: string; status: string;
  nextAttentionDate: string | null; attentionState: string | null; currency: string; expectedAmount: number | null; ownerName: string | null;
  customFields: Record<string, string>;
};

type StatusFilter = "ALL" | "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED";
type AttentionFilter = "ALL" | "OVERDUE" | "DUE" | "UPCOMING" | "NONE";

export function ObligationRegister({ rows, listFields }: { rows: ObligationRegisterRow[]; listFields: ObligationRegisterField[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const categoryOptions = useMemo(() => [{ value: "ALL", label: "All categories" }, ...Array.from(new Set(rows.map((row) => row.category))).sort().map((value) => ({ value, label: value.replaceAll("_", " ") }))], [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || [row.code, row.title, row.organization, row.category, row.counterpartyName, row.ownerName ?? "", ...Object.values(row.customFields)].some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (statusFilter === "ALL" || row.status === statusFilter) && (attentionFilter === "ALL" || (attentionFilter === "NONE" ? row.attentionState == null : row.attentionState === attentionFilter)) && (categoryFilter === "ALL" || row.category === categoryFilter);
    });
  }, [attentionFilter, categoryFilter, rows, search, statusFilter]);
  const hasFilters = search.trim() !== "" || statusFilter !== "ALL" || attentionFilter !== "ALL" || categoryFilter !== "ALL";
  function clearFilters() { setSearch(""); setStatusFilter("ALL"); setAttentionFilter("ALL"); setCategoryFilter("ALL"); }

  const desktop = (
    <Table>
      <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Obligation</TableHead><TableHead>Status</TableHead><TableHead>Next attention</TableHead><TableHead>Expected</TableHead><TableHead>Owner</TableHead>{listFields.map((field) => <TableHead key={field.id}>{field.label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{filteredRows.map((row) => (
        <TableRow key={row.id}>
          <TableCell><Link className="font-mono text-xs underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}`}>{row.code}</Link></TableCell>
          <TableCell>
            <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}`}>{row.title}</Link>
            <p className="text-xs text-muted-foreground">{row.organization} · {row.counterpartyName}</p>
            <Link className="mt-1 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}/lines`}>Agreement lines & schedules</Link>
          </TableCell>
          <TableCell><CorporateStatusBadge status={row.status} /></TableCell>
          <TableCell>{row.nextAttentionDate ? <div className="flex flex-col gap-1"><p className="text-sm tabular-nums">{row.nextAttentionDate}</p>{row.attentionState ? <CorporateStatusBadge status={row.attentionState} /> : null}</div> : "—"}</TableCell>
          <TableCell className="tabular-nums">{formatMoney(row.currency, row.expectedAmount)}</TableCell>
          <TableCell>{row.ownerName ?? "—"}</TableCell>
          {listFields.map((field) => <TableCell key={field.id}>{row.customFields[field.key] ?? "—"}</TableCell>)}
        </TableRow>
      ))}</TableBody>
    </Table>
  );

  const mobile = <ul className="flex flex-col gap-3">{filteredRows.map((row) => (
    <li key={row.id} className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3"><div><Link className="font-medium underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}`}>{row.title}</Link><p className="font-mono text-xs text-muted-foreground">{row.code}</p></div><CorporateStatusBadge status={row.status} /></div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Counterparty</p><p>{row.counterpartyName}</p></div><div><p className="text-xs text-muted-foreground">Expected</p><p>{formatMoney(row.currency, row.expectedAmount)}</p></div><div><p className="text-xs text-muted-foreground">Next attention</p><p>{row.nextAttentionDate ?? "—"}</p></div><div>{row.attentionState ? <CorporateStatusBadge status={row.attentionState} /> : null}</div></div>
      <Button className="mt-3 w-full" size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/corporate/obligations/${row.id}/lines`} />}>Agreement lines & schedules</Button>
    </li>
  ))}</ul>;

  return <div className="flex flex-col gap-4">
    <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search obligations…" resultCount={filteredRows.length}>
      <AfendaSelectFilter ariaLabel="Filter obligations by category" value={categoryFilter} onValueChange={setCategoryFilter} options={categoryOptions} />
      <AfendaSelectFilter ariaLabel="Filter obligations by status" value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)} options={[{ value: "ALL", label: "All statuses" },{ value: "DRAFT", label: "Draft" },{ value: "ACTIVE", label: "Active" },{ value: "ENDED", label: "Ended" },{ value: "CANCELLED", label: "Cancelled" }]} />
      <AfendaSelectFilter ariaLabel="Filter obligations by attention state" value={attentionFilter} onValueChange={(value) => setAttentionFilter(value as AttentionFilter)} options={[{ value: "ALL", label: "All attention" },{ value: "OVERDUE", label: "Overdue" },{ value: "DUE", label: "Due today" },{ value: "UPCOMING", label: "Upcoming" },{ value: "NONE", label: "No next attention" }]} />
      {hasFilters ? <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button> : null}
    </AfendaFilterToolbar>
    {filteredRows.length === 0 ? <AfendaEmptyState title="No obligations found" description="No obligations match the current search and filters." compact /> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
  </div>;
}

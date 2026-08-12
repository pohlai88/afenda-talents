"use client";

import { useMemo, useState } from "react";

import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import { SpreadsheetOperationsGrid } from "@/components/corporate/spreadsheet-operations-grid";
import type { OperationsGridRow, OperationsMatrixRow } from "@/components/corporate/operations-console";
import { Checkbox } from "@/components/ui/checkbox";

export function SpreadsheetOperationsWorkspace({ rows, sites, isAdmin }: {
  rows: OperationsGridRow[];
  sites: Pick<OperationsMatrixRow, "siteId" | "siteCode" | "siteName">[];
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !q || [row.obligationCode, row.obligationTitle, row.lineCode, row.lineName, row.lineType, row.counterparty, ...row.sites].some((value) => value.toLowerCase().includes(q));
      const matchesStatus = status === "ALL" || row.obligationStatus === status;
      const matchesAttention = !attentionOnly || row.overdueDueCount > 0 || (row.recurring && !row.nextDueDate) || !row.lineActive;
      return matchesSearch && matchesStatus && matchesAttention;
    });
  }, [attentionOnly, rows, search, status]);

  return <div className="flex flex-col gap-4">
    <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search agreements, lines, Sites or counterparties…" resultCount={filtered.length} onClear={() => { setSearch(""); setStatus("ALL"); setAttentionOnly(false); }} canClear={Boolean(search || status !== "ALL" || attentionOnly)}>
      <AfendaSelectFilter ariaLabel="Filter spreadsheet by obligation status" value={status} onValueChange={setStatus} options={[{ value: "ALL", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "ENDED", label: "Ended" }, { value: "CANCELLED", label: "Cancelled" }]} />
      <label className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm"><Checkbox checked={attentionOnly} onCheckedChange={(checked) => setAttentionOnly(checked === true)} aria-label="Show spreadsheet attention only" />Attention only</label>
    </AfendaFilterToolbar>
    {filtered.length === 0 ? <AfendaEmptyState title="No matching spreadsheet rows" description="Adjust the search, lifecycle or attention filters." /> : <SpreadsheetOperationsGrid rows={filtered} sites={sites} isAdmin={isAdmin} />}
  </div>;
}

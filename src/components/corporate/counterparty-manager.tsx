"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaRowActions } from "@/components/afenda/row-actions";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import { CounterpartyFormFields, EMPTY_COUNTERPARTY, type CounterpartyDraft } from "@/components/corporate/counterparty-form-fields";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type CounterpartyRow = CounterpartyDraft & { id: string; obligations: number };

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function CounterpartyManager({ rows, definitions, isAdmin }: {
  rows: CounterpartyRow[];
  definitions: CorporateCustomFieldDefinitionDto[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CounterpartyDraft>(EMPTY_COUNTERPARTY);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const set = <K extends keyof CounterpartyDraft>(key: K, value: CounterpartyDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const typeOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((row) => row.type))).sort();
    return [{ value: "ALL", label: "All types" }, ...unique.map((value) => ({ value, label: value.replaceAll("_", " ") }))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || [row.code, row.name, row.type, row.registrationNo, row.contactName, row.contactEmail].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? row.isActive : !row.isActive);
      const matchesType = typeFilter === "ALL" || row.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [rows, search, statusFilter, typeFilter]);

  const hasFilters = search.trim() !== "" || statusFilter !== "ALL" || typeFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  }

  function openCreate() { setDraft(EMPTY_COUNTERPARTY); setEditingId(null); setDialog("create"); }
  function openEdit(row: CounterpartyRow) {
    const { id, obligations: _obligations, ...values } = row;
    void _obligations;
    setDraft(values); setEditingId(id); setDialog("edit");
  }

  async function save() {
    setBusy(true);
    const payload = { ...draft, code: draft.code || null, paymentTermsDays: draft.paymentTermsDays === "" ? null : Number(draft.paymentTermsDays) };
    try {
      const response = await fetch(editingId ? `/api/admin/corporate/counterparties/${editingId}` : "/api/admin/corporate/counterparties", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not save counterparty");
      toast.success(editingId ? "Counterparty updated." : "Counterparty created.");
      setDialog(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save counterparty");
    } finally {
      setBusy(false);
    }
  }

  const desktop = (
    <Table>
      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Obligations</TableHead><TableHead>Status</TableHead>{isAdmin ? <TableHead className="w-10" /> : null}</TableRow></TableHeader>
      <TableBody>
        {filteredRows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.code}</TableCell><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.type.replaceAll("_", " ")}</TableCell><TableCell className="text-muted-foreground">{row.contactName || row.contactEmail || "—"}</TableCell><TableCell className="text-right tabular-nums">{row.obligations}</TableCell><TableCell><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></TableCell>{isAdmin ? <TableCell className="text-right"><AfendaRowActions label={row.name} actions={[{ label: "Edit details", onSelect: () => openEdit(row) }]} /></TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const mobile = (
    <ul className="flex flex-col gap-3">
      {filteredRows.map((row) => (
        <li key={row.id} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.name}</p><p className="font-mono text-xs text-muted-foreground">{row.code}</p></div><div className="flex items-center gap-1"><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge>{isAdmin ? <AfendaRowActions label={row.name} actions={[{ label: "Edit details", onSelect: () => openEdit(row) }]} /> : null}</div></div>
          <p className="text-sm text-muted-foreground">{row.type.replaceAll("_", " ")} · {row.obligations} obligation{row.obligations === 1 ? "" : "s"}</p>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <AfendaSection
        title="Counterparties"
        description="Domain-local registry for landlords, vendors, insurers, financiers, service providers and agencies."
        actions={isAdmin ? <Button onClick={openCreate}>Add counterparty</Button> : undefined}
      >
        {rows.length === 0 ? (
          <Empty className="border border-dashed"><EmptyHeader><EmptyTitle>No counterparties yet</EmptyTitle><EmptyDescription>Create one before registering an obligation.</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <div className="flex flex-col gap-4">
            <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search counterparties…" resultCount={filteredRows.length}>
              <AfendaSelectFilter
                ariaLabel="Filter counterparties by type"
                value={typeFilter}
                onValueChange={setTypeFilter}
                options={typeOptions}
              />
              <AfendaSelectFilter
                ariaLabel="Filter counterparties by status"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              {hasFilters ? <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button> : null}
            </AfendaFilterToolbar>
            {filteredRows.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No counterparties match the current filters.</p> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
          </div>
        )}
      </AfendaSection>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit counterparty" : "Add counterparty"}</DialogTitle><DialogDescription>Core fields stay reportable; custom fields cover organisation-specific details.</DialogDescription></DialogHeader>
          <CounterpartyFormFields draft={draft} set={set} definitions={definitions} />
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !draft.name.trim()}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaRowActions } from "@/components/afenda/row-actions";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ScopeFilter = "ALL" | CorporateCustomFieldDefinitionDto["scope"];
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function CustomFieldList({ fields, isAdmin }: { fields: CorporateCustomFieldDefinitionDto[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    return fields.filter((field) => {
      const matchesSearch = !query || [field.scope, field.key, field.label, field.dataType, field.description ?? ""].some((value) => value.toLowerCase().includes(query));
      const matchesScope = scopeFilter === "ALL" || field.scope === scopeFilter;
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? field.isActive : !field.isActive);
      return matchesSearch && matchesScope && matchesStatus;
    });
  }, [fields, scopeFilter, search, statusFilter]);

  const hasFilters = search.trim() !== "" || scopeFilter !== "ALL" || statusFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setScopeFilter("ALL");
    setStatusFilter("ALL");
  }

  async function toggle(field: CorporateCustomFieldDefinitionDto) {
    setBusyId(field.id);
    try {
      const response = await fetch(`/api/admin/corporate/custom-fields/${field.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !field.isActive }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update field");
      toast.success(field.isActive ? "Custom field deactivated." : "Custom field reactivated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update field");
    } finally {
      setBusyId(null);
    }
  }

  const desktop = (
    <Table>
      <TableHeader><TableRow><TableHead>Record type</TableHead><TableHead>Key</TableHead><TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead>Rules</TableHead><TableHead>Status</TableHead>{isAdmin ? <TableHead className="w-10" /> : null}</TableRow></TableHeader>
      <TableBody>
        {filteredFields.map((field) => (
          <TableRow key={field.id}>
            <TableCell>{field.scope.replaceAll("_", " ")}</TableCell><TableCell className="font-mono text-xs">{field.key}</TableCell><TableCell className="font-medium">{field.label}</TableCell><TableCell>{field.dataType.replaceAll("_", " ")}</TableCell><TableCell className="text-muted-foreground">{[field.required ? "Required" : null, field.showInList ? "List" : null].filter(Boolean).join(" · ") || "Optional"}</TableCell><TableCell><Badge variant={field.isActive ? "default" : "secondary"}>{field.isActive ? "Active" : "Inactive"}</Badge></TableCell>{isAdmin ? <TableCell className="text-right"><AfendaRowActions label={field.label} actions={[{ label: field.isActive ? "Deactivate" : "Reactivate", disabled: busyId === field.id, onSelect: () => void toggle(field) }]} /></TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const mobile = (
    <ul className="flex flex-col gap-3">
      {filteredFields.map((field) => (
        <li key={field.id} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{field.label}</p><p className="font-mono text-xs text-muted-foreground">{field.scope.toLowerCase()} · {field.key}</p></div><div className="flex items-center gap-1"><Badge variant={field.isActive ? "default" : "secondary"}>{field.isActive ? "Active" : "Inactive"}</Badge>{isAdmin ? <AfendaRowActions label={field.label} actions={[{ label: field.isActive ? "Deactivate" : "Reactivate", disabled: busyId === field.id, onSelect: () => void toggle(field) }]} /> : null}</div></div>
          <p className="text-sm text-muted-foreground">{field.dataType.replaceAll("_", " ").toLowerCase()}{field.required ? " · required" : ""}</p>
        </li>
      ))}
    </ul>
  );

  return (
    <AfendaSection title="Configured fields" description="Deactivate fields instead of deleting them so historical values remain interpretable.">
      {fields.length === 0 ? (
        <AfendaEmptyState title="No custom fields configured" description="Create a custom field when organisation-specific structured information is missing from a Corporate Administration record." />
      ) : (
        <div className="flex flex-col gap-4">
          <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search custom fields…" resultCount={filteredFields.length}>
            <AfendaSelectFilter
              ariaLabel="Filter custom fields by record type"
              value={scopeFilter}
              onValueChange={(value) => setScopeFilter(value as ScopeFilter)}
              options={[
                { value: "ALL", label: "All record types" },
                { value: "COUNTERPARTY", label: "Counterparty" },
                { value: "OBLIGATION", label: "Obligation" },
                { value: "DUE_ITEM", label: "Due item" },
                { value: "PAYMENT", label: "Payment" },
              ]}
            />
            <AfendaSelectFilter
              ariaLabel="Filter custom fields by status"
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
          {filteredFields.length === 0 ? (
            <AfendaEmptyState title="No custom fields found" description="No custom fields match the current search and filters." compact />
          ) : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
        </div>
      )}
    </AfendaSection>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaRowActions } from "@/components/afenda/row-actions";
import { AfendaSection } from "@/components/afenda/section";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CustomFieldList({ fields, isAdmin }: { fields: CorporateCustomFieldDefinitionDto[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((field) => [field.scope, field.key, field.label, field.dataType, field.description ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [fields, search]);

  async function toggle(field: CorporateCustomFieldDefinitionDto) {
    setBusyId(field.id);
    try {
      const response = await fetch(`/api/admin/corporate/custom-fields/${field.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !field.isActive }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update field");
      toast.success(field.isActive ? "Custom field deactivated." : "Custom field reactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update field"); }
    finally { setBusyId(null); }
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
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">No custom fields configured.</p> : (
        <div className="space-y-4">
          <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search custom fields…" resultCount={filteredFields.length} />
          {filteredFields.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No custom fields match this search.</p> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
        </div>
      )}
    </AfendaSection>
  );
}

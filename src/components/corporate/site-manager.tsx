"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SITE_TYPE_SUGGESTIONS } from "@/lib/corporate-admin/domain";

type SiteDraft = {
  code: string;
  name: string;
  type: string;
  organization: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  timezone: string;
  isActive: boolean;
  notes: string;
  customFields: Record<string, unknown>;
};

const EMPTY_SITE: SiteDraft = {
  code: "", name: "", type: "OFFICE", organization: "", addressLine1: "", addressLine2: "", city: "", stateRegion: "", postalCode: "", countryCode: "MY", timezone: "Asia/Kuala_Lumpur", isActive: true, notes: "", customFields: {},
};

export type SiteRow = SiteDraft & {
  id: string;
  counterparties: number;
  obligations: number;
};

export function SiteManager({ rows, definitions, isAdmin }: { rows: SiteRow[]; definitions: CorporateCustomFieldDefinitionDto[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SiteDraft>(EMPTY_SITE);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

  const typeOptions = useMemo(() => [{ value: "ALL", label: "All site types" }, ...Array.from(new Set([...SITE_TYPE_SUGGESTIONS, ...rows.map((row) => row.type)])).sort().map((value) => ({ value, label: value.replaceAll("_", " ") }))], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchHit = !q || [row.code, row.name, row.type, row.organization, row.city, row.stateRegion, row.addressLine1].some((value) => value.toLowerCase().includes(q));
      const typeHit = typeFilter === "ALL" || row.type === typeFilter;
      const statusHit = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? row.isActive : !row.isActive);
      return searchHit && typeHit && statusHit;
    });
  }, [rows, search, statusFilter, typeFilter]);

  function set<K extends keyof SiteDraft>(key: K, value: SiteDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }

  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not create site");
      toast.success("Site created.");
      setOpen(false); setDraft(EMPTY_SITE); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create site"); }
    finally { setBusy(false); }
  }

  const desktop = <Table><TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Type</TableHead><TableHead>Organisation</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Counterparties</TableHead><TableHead className="text-right">Obligations</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{filtered.map((row) => <TableRow key={row.id}><TableCell><Link href={`/admin/corporate/sites/${row.id}`} className="font-medium underline-offset-4 hover:underline">{row.name}</Link><p className="font-mono text-xs text-muted-foreground">{row.code}</p></TableCell><TableCell>{row.type.replaceAll("_", " ")}</TableCell><TableCell>{row.organization || "—"}</TableCell><TableCell className="text-muted-foreground">{[row.city, row.stateRegion].filter(Boolean).join(", ") || "—"}</TableCell><TableCell className="text-right tabular-nums">{row.counterparties}</TableCell><TableCell className="text-right tabular-nums">{row.obligations}</TableCell><TableCell><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></TableCell></TableRow>)}</TableBody></Table>;

  const mobile = <ul className="flex flex-col gap-3">{filtered.map((row) => <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/admin/corporate/sites/${row.id}`} className="font-medium underline-offset-4 hover:underline">{row.name}</Link><p className="font-mono text-xs text-muted-foreground">{row.code}</p></div><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{row.type.replaceAll("_", " ")} · {row.counterparties} counterparties · {row.obligations} obligations</p></li>)}</ul>;

  return <>
    <AfendaSection title="Site register" description="Locations are first-class operating contexts. Open a site to see its service coverage, counterparties and obligations together." actions={isAdmin ? <Button onClick={() => setOpen(true)}>Add site</Button> : undefined}>
      {rows.length === 0 ? <AfendaEmptyState title="No sites yet" description="Add the locations where Corporate Administration obligations and services actually operate." /> : <div className="flex flex-col gap-4"><AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search sites…" resultCount={filtered.length}><AfendaSelectFilter ariaLabel="Filter sites by type" value={typeFilter} onValueChange={setTypeFilter} options={typeOptions} /><AfendaSelectFilter ariaLabel="Filter sites by status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "ALL", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} /></AfendaFilterToolbar>{filtered.length === 0 ? <AfendaEmptyState compact title="No matching sites" description="Adjust the current search or filters." /> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}</div>}
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add site" description="Create an operating location. Service providers and obligations can then be related to it without duplicating site details." contentClassName="sm:max-w-3xl" footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void create()} disabled={busy || !draft.name.trim() || !draft.type.trim()}>{busy ? "Creating…" : "Create site"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AfendaField label="Site name" id="site-name" required><Input id="site-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Klang Headquarters" /></AfendaField>
        <AfendaField label="Site code" id="site-code"><Input id="site-code" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="Auto-generated if blank" /></AfendaField>
        <AfendaField label="Site type" id="site-type" required><Input id="site-type" list="site-types" value={draft.type} onChange={(e) => set("type", e.target.value.toUpperCase())} /><datalist id="site-types">{SITE_TYPE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></AfendaField>
        <AfendaField label="Organisation" id="site-org"><Input id="site-org" value={draft.organization} onChange={(e) => set("organization", e.target.value)} /></AfendaField>
        <AfendaField label="Address line 1" id="site-address1" className="sm:col-span-2"><Input id="site-address1" value={draft.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} /></AfendaField>
        <AfendaField label="Address line 2" id="site-address2" className="sm:col-span-2"><Input id="site-address2" value={draft.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} /></AfendaField>
        <AfendaField label="City" id="site-city"><Input id="site-city" value={draft.city} onChange={(e) => set("city", e.target.value)} /></AfendaField>
        <AfendaField label="State / region" id="site-state"><Input id="site-state" value={draft.stateRegion} onChange={(e) => set("stateRegion", e.target.value)} /></AfendaField>
        <AfendaField label="Postal code" id="site-postcode"><Input id="site-postcode" value={draft.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></AfendaField>
        <AfendaField label="Country code" id="site-country"><Input id="site-country" maxLength={2} value={draft.countryCode} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} /></AfendaField>
        <AfendaField label="Timezone" id="site-timezone" className="sm:col-span-2"><Input id="site-timezone" value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} /></AfendaField>
        <div className="sm:col-span-2"><AfendaCheckField label="Active site" checked={draft.isActive} onChange={(value) => set("isActive", value)} /></div>
        <AfendaField label="Notes" id="site-notes" className="sm:col-span-2"><Textarea id="site-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} /></AfendaField>
        <div className="sm:col-span-2"><CustomFieldControls definitions={definitions} values={draft.customFields} onChange={(value) => set("customFields", value)} /></div>
      </div>
    </AfendaResponsiveOverlay>
  </>;
}

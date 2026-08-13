"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
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

export type SiteRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  organization: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  timezone: string | null;
  isActive: boolean;
  notes: string | null;
  customFields: Record<string, unknown>;
  counterparties: number;
  obligations: number;
};

function SiteFieldGrid({
  mode,
  definitions,
  code, setCode,
  name, setName,
  type, setType,
  organization, setOrganization,
  addressLine1, setAddressLine1,
  addressLine2, setAddressLine2,
  city, setCity,
  stateRegion, setStateRegion,
  postalCode, setPostalCode,
  countryCode, setCountryCode,
  timezone, setTimezone,
  isActive, setIsActive,
  notes, setNotes,
  customFields, setCustomFields,
}: {
  mode: "add" | "edit";
  definitions: CorporateCustomFieldDefinitionDto[];
  code: string; setCode: (value: string) => void;
  name: string; setName: (value: string) => void;
  type: string; setType: (value: string) => void;
  organization: string; setOrganization: (value: string) => void;
  addressLine1: string; setAddressLine1: (value: string) => void;
  addressLine2: string; setAddressLine2: (value: string) => void;
  city: string; setCity: (value: string) => void;
  stateRegion: string; setStateRegion: (value: string) => void;
  postalCode: string; setPostalCode: (value: string) => void;
  countryCode: string; setCountryCode: (value: string) => void;
  timezone: string; setTimezone: (value: string) => void;
  isActive: boolean; setIsActive: (value: boolean) => void;
  notes: string; setNotes: (value: string) => void;
  customFields: Record<string, unknown>; setCustomFields: (value: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AfendaField label="Site name" id="site-name" required><Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Klang Headquarters" /></AfendaField>
      <AfendaField label="Site code" id="site-code"><Input id="site-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={mode === "edit" ? "Leave unchanged" : "Auto-generated if blank"} /></AfendaField>
      <AfendaField label="Site type" id="site-type" required><Input id="site-type" list="site-types" value={type} onChange={(e) => setType(e.target.value.toUpperCase())} /><datalist id="site-types">{SITE_TYPE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></AfendaField>
      <AfendaField label="Organisation" id="site-org"><Input id="site-org" value={organization} onChange={(e) => setOrganization(e.target.value)} /></AfendaField>
      <AfendaField label="Address line 1" id="site-address1" className="sm:col-span-2"><Input id="site-address1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} /></AfendaField>
      <AfendaField label="Address line 2" id="site-address2" className="sm:col-span-2"><Input id="site-address2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} /></AfendaField>
      <AfendaField label="City" id="site-city"><Input id="site-city" value={city} onChange={(e) => setCity(e.target.value)} /></AfendaField>
      <AfendaField label="State / region" id="site-state"><Input id="site-state" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} /></AfendaField>
      <AfendaField label="Postal code" id="site-postcode"><Input id="site-postcode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></AfendaField>
      <AfendaField label="Country code" id="site-country"><Input id="site-country" maxLength={2} value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} /></AfendaField>
      <AfendaField label="Timezone" id="site-timezone" className="sm:col-span-2"><Input id="site-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></AfendaField>
      {mode === "add" ? <div className="sm:col-span-2"><AfendaCheckField label="Active site" checked={isActive} onChange={setIsActive} /></div> : null}
      <AfendaField label="Notes" id="site-notes" className="sm:col-span-2"><Textarea id="site-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></AfendaField>
      <div className="sm:col-span-2"><CustomFieldControls definitions={definitions} values={customFields} onChange={setCustomFields} /></div>
    </div>
  );
}

export function SiteManager({ rows, definitions, isAdmin }: { rows: SiteRow[]; definitions: CorporateCustomFieldDefinitionDto[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SiteDraft>(EMPTY_SITE);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const typeOptions = useMemo(() => [{ value: "ALL", label: "All site types" }, ...Array.from(new Set([...SITE_TYPE_SUGGESTIONS, ...rows.map((row) => row.type)])).sort().map((value) => ({ value, label: value.replaceAll("_", " ") }))], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchHit = !q || [row.code, row.name, row.type, row.organization, row.city, row.stateRegion, row.addressLine1].some((value) => (value ?? "").toLowerCase().includes(q));
      const typeHit = typeFilter === "ALL" || row.type === typeFilter;
      const statusHit = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? row.isActive : !row.isActive);
      return searchHit && typeHit && statusHit;
    });
  }, [rows, search, statusFilter, typeFilter]);
  const editingRow = rows.find((row) => row.id === editingId) ?? null;

  function set<K extends keyof SiteDraft>(key: K, value: SiteDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }

  function resetForm() {
    setDraft(EMPTY_SITE);
  }

  function beginAddSite() {
    resetForm();
    setOpen(true);
  }

  function beginEditSite(row: SiteRow) {
    setDraft({
      code: row.code,
      name: row.name,
      type: row.type,
      organization: row.organization ?? "",
      addressLine1: row.addressLine1 ?? "",
      addressLine2: row.addressLine2 ?? "",
      city: row.city ?? "",
      stateRegion: row.stateRegion ?? "",
      postalCode: row.postalCode ?? "",
      countryCode: row.countryCode ?? "",
      timezone: row.timezone ?? "",
      isActive: row.isActive,
      notes: row.notes ?? "",
      customFields: row.customFields,
    });
    setEditingId(row.id);
  }

  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not create site");
      toast.success("Site created.");
      setOpen(false); resetForm(); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create site"); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!editingId) return;
    setBusy(true);
    try {
      const { isActive: _isActive, ...payload } = draft;
      void _isActive;
      const response = await fetch(`/api/admin/corporate/sites/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", ...payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site");
      toast.success("Site updated.");
      setEditingId(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site"); }
    finally { setBusy(false); }
  }

  async function setSiteActive(row: { id: string; isActive: boolean }, isActive: boolean) {
    setUpdatingId(row.id);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site");
      if (!isActive && statusFilter === "ACTIVE") setStatusFilter("ALL");
      toast.success(isActive ? "Site reactivated." : "Site deactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site"); }
    finally { setUpdatingId(null); }
  }

  const desktop = <Table><TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Type</TableHead><TableHead>Organisation</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Counterparties</TableHead><TableHead className="text-right">Obligations</TableHead><TableHead>Status</TableHead><TableHead className="sr-only">Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map((row) => <TableRow key={row.id}><TableCell><Link href={`/admin/corporate/sites/${row.id}`} className="font-medium underline-offset-4 hover:underline">{row.name}</Link><p className="font-mono text-xs text-muted-foreground">{row.code}</p></TableCell><TableCell>{row.type.replaceAll("_", " ")}</TableCell><TableCell>{row.organization || "—"}</TableCell><TableCell className="text-muted-foreground">{[row.city, row.stateRegion].filter(Boolean).join(", ") || "—"}</TableCell><TableCell className="text-right tabular-nums">{row.counterparties}</TableCell><TableCell className="text-right tabular-nums">{row.obligations}</TableCell><TableCell><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{isAdmin ? <div className="flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEditSite(row)}>Edit</Button>
    {row.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate site?" description="The site stays in history and on existing obligations, but is no longer offered for new links or coverage." confirmLabel="Deactivate" onConfirm={() => setSiteActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setSiteActive(row, true)}>Reactivate</Button>}
  </div> : null}</TableCell></TableRow>)}</TableBody></Table>;

  const mobile = <ul className="flex flex-col gap-3">{filtered.map((row) => <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/admin/corporate/sites/${row.id}`} className="font-medium underline-offset-4 hover:underline">{row.name}</Link><p className="font-mono text-xs text-muted-foreground">{row.code}</p></div><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{row.type.replaceAll("_", " ")} · {row.counterparties} counterparties · {row.obligations} obligations</p>{isAdmin ? <div className="mt-3 flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEditSite(row)}>Edit</Button>
    {row.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate site?" description="The site stays in history and on existing obligations, but is no longer offered for new links or coverage." confirmLabel="Deactivate" onConfirm={() => setSiteActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setSiteActive(row, true)}>Reactivate</Button>}
  </div> : null}</li>)}</ul>;

  return <>
    <AfendaSection title="Site register" description="Locations are first-class operating contexts. Open a site to see its service coverage, counterparties and obligations together." actions={isAdmin ? <Button onClick={beginAddSite}>Add site</Button> : undefined}>
      {rows.length === 0 ? <AfendaEmptyState title="No sites yet" description="Add the locations where Corporate Administration obligations and services actually operate." /> : <div className="flex flex-col gap-4"><AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search sites…" resultCount={filtered.length}><AfendaSelectFilter ariaLabel="Filter sites by type" value={typeFilter} onValueChange={setTypeFilter} options={typeOptions} /><AfendaSelectFilter ariaLabel="Filter sites by status" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "ALL", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} /></AfendaFilterToolbar>{filtered.length === 0 ? <AfendaEmptyState compact title="No matching sites" description="Adjust the current search or filters." /> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}</div>}
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add site" description="Create an operating location. Service providers and obligations can then be related to it without duplicating site details." contentClassName="sm:max-w-3xl" footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void create()} disabled={busy || !draft.name.trim() || !draft.type.trim()}>{busy ? "Creating…" : "Create site"}</Button></>}>
      <SiteFieldGrid
        mode="add"
        definitions={definitions}
        code={draft.code} setCode={(v) => set("code", v)}
        name={draft.name} setName={(v) => set("name", v)}
        type={draft.type} setType={(v) => set("type", v)}
        organization={draft.organization} setOrganization={(v) => set("organization", v)}
        addressLine1={draft.addressLine1} setAddressLine1={(v) => set("addressLine1", v)}
        addressLine2={draft.addressLine2} setAddressLine2={(v) => set("addressLine2", v)}
        city={draft.city} setCity={(v) => set("city", v)}
        stateRegion={draft.stateRegion} setStateRegion={(v) => set("stateRegion", v)}
        postalCode={draft.postalCode} setPostalCode={(v) => set("postalCode", v)}
        countryCode={draft.countryCode} setCountryCode={(v) => set("countryCode", v)}
        timezone={draft.timezone} setTimezone={(v) => set("timezone", v)}
        isActive={draft.isActive} setIsActive={(v) => set("isActive", v)}
        notes={draft.notes} setNotes={(v) => set("notes", v)}
        customFields={draft.customFields} setCustomFields={(v) => set("customFields", v)}
      />
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={editingId !== null} onOpenChange={(next) => !next && setEditingId(null)} title={editingRow ? `Edit ${editingRow.name}` : "Edit site"} description="Correct this site's details. Leaving the code blank keeps the existing one." contentClassName="sm:max-w-3xl" footer={<><Button variant="outline" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !draft.name.trim() || !draft.type.trim()}>{busy ? "Saving…" : "Save changes"}</Button></>}>
      <SiteFieldGrid
        mode="edit"
        definitions={definitions}
        code={draft.code} setCode={(v) => set("code", v)}
        name={draft.name} setName={(v) => set("name", v)}
        type={draft.type} setType={(v) => set("type", v)}
        organization={draft.organization} setOrganization={(v) => set("organization", v)}
        addressLine1={draft.addressLine1} setAddressLine1={(v) => set("addressLine1", v)}
        addressLine2={draft.addressLine2} setAddressLine2={(v) => set("addressLine2", v)}
        city={draft.city} setCity={(v) => set("city", v)}
        stateRegion={draft.stateRegion} setStateRegion={(v) => set("stateRegion", v)}
        postalCode={draft.postalCode} setPostalCode={(v) => set("postalCode", v)}
        countryCode={draft.countryCode} setCountryCode={(v) => set("countryCode", v)}
        timezone={draft.timezone} setTimezone={(v) => set("timezone", v)}
        isActive={draft.isActive} setIsActive={(v) => set("isActive", v)}
        notes={draft.notes} setNotes={(v) => set("notes", v)}
        customFields={draft.customFields} setCustomFields={(v) => set("customFields", v)}
      />
    </AfendaResponsiveOverlay>
  </>;
}

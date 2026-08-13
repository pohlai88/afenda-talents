"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { AfendaSection } from "@/components/afenda/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_CATEGORY_SUGGESTIONS } from "@/lib/corporate-admin/domain";

export type SiteCoverageRow = {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyCode: string;
  serviceCategory: string;
  roleCode: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isPrimary: boolean;
  isActive: boolean;
  serviceLevel: string | null;
  emergencyContact: string | null;
  notes: string | null;
};

function CoverageFieldGrid({
  showCounterparty,
  counterparties,
  counterpartyId, setCounterpartyId,
  serviceCategory, setServiceCategory,
  roleCode, setRoleCode,
  serviceLevel, setServiceLevel,
  effectiveFrom, setEffectiveFrom,
  effectiveTo, setEffectiveTo,
  emergencyContact, setEmergencyContact,
  isPrimary, setIsPrimary,
  notes, setNotes,
}: {
  showCounterparty: boolean;
  counterparties: Array<{ id: string; code: string; name: string }>;
  counterpartyId: string; setCounterpartyId: (value: string) => void;
  serviceCategory: string; setServiceCategory: (value: string) => void;
  roleCode: string; setRoleCode: (value: string) => void;
  serviceLevel: string; setServiceLevel: (value: string) => void;
  effectiveFrom: string; setEffectiveFrom: (value: string) => void;
  effectiveTo: string; setEffectiveTo: (value: string) => void;
  emergencyContact: string; setEmergencyContact: (value: string) => void;
  isPrimary: boolean; setIsPrimary: (value: boolean) => void;
  notes: string; setNotes: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showCounterparty ? <AfendaField label="Counterparty" id="coverage-counterparty" required><Select value={counterpartyId} onValueChange={setCounterpartyId}><SelectTrigger id="coverage-counterparty" className="w-full"><SelectValue placeholder="Select counterparty" /></SelectTrigger><SelectContent><SelectGroup>{counterparties.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectGroup></SelectContent></Select></AfendaField> : null}
      <AfendaField label="Service category" id="coverage-service" required><Input id="coverage-service" list="coverage-services" value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value.toUpperCase())} /><datalist id="coverage-services">{SERVICE_CATEGORY_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></AfendaField>
      <AfendaField label="Relationship role" id="coverage-role"><Input id="coverage-role" value={roleCode} onChange={(e) => setRoleCode(e.target.value.toUpperCase())} placeholder="e.g. PRIMARY_PROVIDER" /></AfendaField>
      <AfendaField label="Service level" id="coverage-level"><Input id="coverage-level" value={serviceLevel} onChange={(e) => setServiceLevel(e.target.value)} placeholder="e.g. 24/7 emergency response" /></AfendaField>
      <AfendaField label="Effective from" id="coverage-from"><Input id="coverage-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></AfendaField>
      <AfendaField label="Effective to" id="coverage-to"><Input id="coverage-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /></AfendaField>
      <AfendaField label="Emergency contact" id="coverage-emergency" className="sm:col-span-2"><Input id="coverage-emergency" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} /></AfendaField>
      <div className="sm:col-span-2"><AfendaCheckField label="Primary provider for this service" checked={isPrimary} onChange={setIsPrimary} /></div>
      <AfendaField label="Notes" id="coverage-notes" className="sm:col-span-2"><Textarea id="coverage-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></AfendaField>
    </div>
  );
}

export function SiteCoverageManager({ siteId, rows, counterparties, isAdmin }: {
  siteId: string;
  rows: SiteCoverageRow[];
  counterparties: Array<{ id: string; code: string; name: string }>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counterpartyId, setCounterpartyId] = useState("");
  const [serviceCategory, setServiceCategory] = useState("FACILITY_MAINTENANCE");
  const [roleCode, setRoleCode] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [serviceLevel, setServiceLevel] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<SiteCoverageRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function resetForm() {
    setCounterpartyId(""); setServiceCategory("FACILITY_MAINTENANCE"); setRoleCode(""); setEffectiveFrom(""); setEffectiveTo(""); setIsPrimary(false); setServiceLevel(""); setEmergencyContact(""); setNotes("");
  }

  function beginAdd() {
    resetForm();
    setOpen(true);
  }

  function beginEdit(row: SiteCoverageRow) {
    setServiceCategory(row.serviceCategory);
    setRoleCode(row.roleCode ?? "");
    setEffectiveFrom(row.effectiveFrom ?? "");
    setEffectiveTo(row.effectiveTo ?? "");
    setIsPrimary(row.isPrimary);
    setServiceLevel(row.serviceLevel ?? "");
    setEmergencyContact(row.emergencyContact ?? "");
    setNotes(row.notes ?? "");
    setEditing(row);
  }

  async function add() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${siteId}/coverage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterpartyId, serviceCategory, roleCode: roleCode || null, effectiveFrom: effectiveFrom || null, effectiveTo: effectiveTo || null, isPrimary, isActive: true, serviceLevel: serviceLevel || null, emergencyContact: emergencyContact || null, notes: notes || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not add service coverage");
      toast.success("Service coverage added.");
      setOpen(false); resetForm(); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add service coverage"); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${siteId}/coverage/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          serviceCategory,
          roleCode: roleCode || null,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          isPrimary,
          serviceLevel: serviceLevel || null,
          emergencyContact: emergencyContact || null,
          notes: notes || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update coverage");
      toast.success("Service coverage updated.");
      setEditing(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update coverage"); }
    finally { setBusy(false); }
  }

  async function setCoverageActive(row: SiteCoverageRow, isActive: boolean) {
    setUpdatingId(row.id);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${siteId}/coverage/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update coverage");
      toast.success(isActive ? "Coverage reactivated." : "Coverage deactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update coverage"); }
    finally { setUpdatingId(null); }
  }

  const desktop = <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="px-2 py-3 font-medium">Service</th><th className="px-2 py-3 font-medium">Counterparty</th><th className="px-2 py-3 font-medium">Role / service level</th><th className="px-2 py-3 font-medium">Effective</th><th className="px-2 py-3 font-medium">Status</th><th className="px-2 py-3 font-medium sr-only">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-2 py-3 font-medium">{row.serviceCategory.replaceAll("_", " ")}{row.isPrimary ? <Badge variant="outline" className="ml-2">Primary</Badge> : null}</td><td className="px-2 py-3"><Link href={`/admin/corporate/counterparties/${row.counterpartyId}`} className="underline-offset-4 hover:underline">{row.counterpartyName}</Link><p className="font-mono text-xs text-muted-foreground">{row.counterpartyCode}</p></td><td className="px-2 py-3 text-muted-foreground">{[row.roleCode, row.serviceLevel].filter(Boolean).join(" · ") || "—"}</td><td className="px-2 py-3 text-muted-foreground">{row.effectiveFrom || "—"} → {row.effectiveTo || "open"}</td><td className="px-2 py-3"><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></td><td className="px-2 py-3">{isAdmin ? <div className="flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(row)}>Edit</Button>
    {row.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate coverage?" description="The coverage row stays in history but no longer counts as current service for this site." confirmLabel="Deactivate" onConfirm={() => setCoverageActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setCoverageActive(row, true)}>Reactivate</Button>}
  </div> : null}</td></tr>)}</tbody></table></div>;

  const mobile = <ul className="flex flex-col gap-3">{rows.map((row) => <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.serviceCategory.replaceAll("_", " ")}</p><Link href={`/admin/corporate/counterparties/${row.counterpartyId}`} className="text-sm underline-offset-4 hover:underline">{row.counterpartyName}</Link></div><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{[row.roleCode, row.serviceLevel, row.emergencyContact].filter(Boolean).join(" · ") || "No additional coverage details"}</p>{isAdmin ? <div className="mt-3 flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(row)}>Edit</Button>
    {row.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate coverage?" description="The coverage row stays in history but no longer counts as current service for this site." confirmLabel="Deactivate" onConfirm={() => setCoverageActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setCoverageActive(row, true)}>Reactivate</Button>}
  </div> : null}</li>)}</ul>;

  return <>
    <AfendaSection title="Service coverage" description="Who serves this site, for what service, and during which effective period." actions={isAdmin ? <Button size="sm" onClick={beginAdd}>Add coverage</Button> : undefined}>
      {rows.length === 0 ? <AfendaEmptyState title="No service coverage" description="This site has no linked service providers yet. Add coverage so Afenda can detect operational gaps by location." compact /> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add site service coverage" description="Link a counterparty to this site with business meaning. The relationship carries the service category, role and effective dates." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void add()} disabled={busy || !counterpartyId || !serviceCategory}>{busy ? "Adding…" : "Add coverage"}</Button></>}>
      <CoverageFieldGrid
        showCounterparty
        counterparties={counterparties}
        counterpartyId={counterpartyId} setCounterpartyId={setCounterpartyId}
        serviceCategory={serviceCategory} setServiceCategory={setServiceCategory}
        roleCode={roleCode} setRoleCode={setRoleCode}
        serviceLevel={serviceLevel} setServiceLevel={setServiceLevel}
        effectiveFrom={effectiveFrom} setEffectiveFrom={setEffectiveFrom}
        effectiveTo={effectiveTo} setEffectiveTo={setEffectiveTo}
        emergencyContact={emergencyContact} setEmergencyContact={setEmergencyContact}
        isPrimary={isPrimary} setIsPrimary={setIsPrimary}
        notes={notes} setNotes={setNotes}
      />
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={editing !== null} onOpenChange={(next) => !next && setEditing(null)} title="Edit service coverage" description="Correct this coverage row. To change which counterparty provides the service, stand this row down and add a new one." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !serviceCategory}>{busy ? "Saving…" : "Save changes"}</Button></>}>
      <CoverageFieldGrid
        showCounterparty={false}
        counterparties={counterparties}
        counterpartyId={counterpartyId} setCounterpartyId={setCounterpartyId}
        serviceCategory={serviceCategory} setServiceCategory={setServiceCategory}
        roleCode={roleCode} setRoleCode={setRoleCode}
        serviceLevel={serviceLevel} setServiceLevel={setServiceLevel}
        effectiveFrom={effectiveFrom} setEffectiveFrom={setEffectiveFrom}
        effectiveTo={effectiveTo} setEffectiveTo={setEffectiveTo}
        emergencyContact={emergencyContact} setEmergencyContact={setEmergencyContact}
        isPrimary={isPrimary} setIsPrimary={setIsPrimary}
        notes={notes} setNotes={setNotes}
      />
    </AfendaResponsiveOverlay>
  </>;
}

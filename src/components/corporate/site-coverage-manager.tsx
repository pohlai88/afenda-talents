"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
};

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
      setOpen(false); setCounterpartyId(""); setRoleCode(""); setEffectiveFrom(""); setEffectiveTo(""); setIsPrimary(false); setServiceLevel(""); setEmergencyContact(""); setNotes(""); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add service coverage"); }
    finally { setBusy(false); }
  }

  const desktop = <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="px-2 py-3 font-medium">Service</th><th className="px-2 py-3 font-medium">Counterparty</th><th className="px-2 py-3 font-medium">Role / service level</th><th className="px-2 py-3 font-medium">Effective</th><th className="px-2 py-3 font-medium">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-2 py-3 font-medium">{row.serviceCategory.replaceAll("_", " ")}{row.isPrimary ? <Badge variant="outline" className="ml-2">Primary</Badge> : null}</td><td className="px-2 py-3"><Link href={`/admin/corporate/counterparties/${row.counterpartyId}`} className="underline-offset-4 hover:underline">{row.counterpartyName}</Link><p className="font-mono text-xs text-muted-foreground">{row.counterpartyCode}</p></td><td className="px-2 py-3 text-muted-foreground">{[row.roleCode, row.serviceLevel].filter(Boolean).join(" · ") || "—"}</td><td className="px-2 py-3 text-muted-foreground">{row.effectiveFrom || "—"} → {row.effectiveTo || "open"}</td><td className="px-2 py-3"><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></td></tr>)}</tbody></table></div>;

  const mobile = <ul className="flex flex-col gap-3">{rows.map((row) => <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.serviceCategory.replaceAll("_", " ")}</p><Link href={`/admin/corporate/counterparties/${row.counterpartyId}`} className="text-sm underline-offset-4 hover:underline">{row.counterpartyName}</Link></div><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{[row.roleCode, row.serviceLevel, row.emergencyContact].filter(Boolean).join(" · ") || "No additional coverage details"}</p></li>)}</ul>;

  return <>
    <AfendaSection title="Service coverage" description="Who serves this site, for what service, and during which effective period." actions={isAdmin ? <Button size="sm" onClick={() => setOpen(true)}>Add coverage</Button> : undefined}>
      {rows.length === 0 ? <AfendaEmptyState title="No service coverage" description="This site has no linked service providers yet. Add coverage so Afenda can detect operational gaps by location." compact /> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add site service coverage" description="Link a counterparty to this site with business meaning. The relationship carries the service category, role and effective dates." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void add()} disabled={busy || !counterpartyId || !serviceCategory}>{busy ? "Adding…" : "Add coverage"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AfendaField label="Counterparty" id="coverage-counterparty" required><Select value={counterpartyId} onValueChange={setCounterpartyId}><SelectTrigger id="coverage-counterparty" className="w-full"><SelectValue placeholder="Select counterparty" /></SelectTrigger><SelectContent><SelectGroup>{counterparties.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectGroup></SelectContent></Select></AfendaField>
        <AfendaField label="Service category" id="coverage-service" required><Input id="coverage-service" list="coverage-services" value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value.toUpperCase())} /><datalist id="coverage-services">{SERVICE_CATEGORY_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></AfendaField>
        <AfendaField label="Relationship role" id="coverage-role"><Input id="coverage-role" value={roleCode} onChange={(e) => setRoleCode(e.target.value.toUpperCase())} placeholder="e.g. PRIMARY_PROVIDER" /></AfendaField>
        <AfendaField label="Service level" id="coverage-level"><Input id="coverage-level" value={serviceLevel} onChange={(e) => setServiceLevel(e.target.value)} placeholder="e.g. 24/7 emergency response" /></AfendaField>
        <AfendaField label="Effective from" id="coverage-from"><Input id="coverage-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></AfendaField>
        <AfendaField label="Effective to" id="coverage-to"><Input id="coverage-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /></AfendaField>
        <AfendaField label="Emergency contact" id="coverage-emergency" className="sm:col-span-2"><Input id="coverage-emergency" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} /></AfendaField>
        <div className="sm:col-span-2"><AfendaCheckField label="Primary provider for this service" checked={isPrimary} onChange={setIsPrimary} /></div>
        <AfendaField label="Notes" id="coverage-notes" className="sm:col-span-2"><Textarea id="coverage-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>
  </>;
}

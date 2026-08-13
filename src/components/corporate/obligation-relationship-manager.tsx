"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { AfendaSection } from "@/components/afenda/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OBLIGATION_PARTY_ROLE_SUGGESTIONS } from "@/lib/corporate-admin/domain";

export type ObligationSiteRelation = { id: string; code: string; name: string; type: string; scopeRole: string | null; isActive: boolean; notes: string | null };
export type ObligationPartyRelation = { counterpartyId: string; code: string; name: string; roleCode: string; isPrimary: boolean; effectiveFrom: string | null; effectiveTo: string | null; isActive: boolean; notes: string | null };

export function ObligationRelationshipManager({
  obligationId,
  sites,
  parties,
  siteOptions,
  counterpartyOptions,
  isAdmin,
}: {
  obligationId: string;
  sites: ObligationSiteRelation[];
  parties: ObligationPartyRelation[];
  siteOptions: Array<{ id: string; code: string; name: string }>;
  counterpartyOptions: Array<{ id: string; code: string; name: string }>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [scopeRole, setScopeRole] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [roleCode, setRoleCode] = useState("SERVICE_PROVIDER");
  const [isPrimary, setIsPrimary] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [partyNotes, setPartyNotes] = useState("");
  const [editingSite, setEditingSite] = useState<ObligationSiteRelation | null>(null);
  const [editingParty, setEditingParty] = useState<ObligationPartyRelation | null>(null);

  function resetSiteForm() {
    setSiteId(""); setScopeRole(""); setSiteNotes("");
  }

  function resetPartyForm() {
    setCounterpartyId(""); setRoleCode("SERVICE_PROVIDER"); setIsPrimary(false); setEffectiveFrom(""); setEffectiveTo(""); setPartyNotes("");
  }

  function beginAddSite() {
    resetSiteForm();
    setSiteOpen(true);
  }

  function beginAddParty() {
    resetPartyForm();
    setPartyOpen(true);
  }

  function beginEditSite(site: ObligationSiteRelation) {
    setScopeRole(site.scopeRole ?? "");
    setSiteNotes(site.notes ?? "");
    setEditingSite(site);
  }

  function beginEditParty(party: ObligationPartyRelation) {
    setIsPrimary(party.isPrimary);
    setEffectiveFrom(party.effectiveFrom ?? "");
    setEffectiveTo(party.effectiveTo ?? "");
    setPartyNotes(party.notes ?? "");
    setEditingParty(party);
  }

  async function addSite() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/sites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, scopeRole: scopeRole || null, notes: siteNotes || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not link site");
      toast.success("Site linked to obligation."); setSiteOpen(false); resetSiteForm(); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not link site"); }
    finally { setBusy(false); }
  }

  async function addParty() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/parties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ counterpartyId, roleCode, isPrimary, effectiveFrom: effectiveFrom || null, effectiveTo: effectiveTo || null, notes: partyNotes || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not link counterparty role");
      toast.success("Counterparty role linked."); setPartyOpen(false); resetPartyForm(); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not link counterparty role"); }
    finally { setBusy(false); }
  }

  async function saveSiteLink() {
    if (!editingSite) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/sites/${editingSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", scopeRole: scopeRole || null, notes: siteNotes || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site link");
      toast.success("Site link updated.");
      setEditingSite(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site link"); }
    finally { setBusy(false); }
  }

  async function savePartyLink() {
    if (!editingParty) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/parties`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          counterpartyId: editingParty.counterpartyId,
          roleCode: editingParty.roleCode,
          isPrimary,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          notes: partyNotes || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update party");
      toast.success("Party updated.");
      setEditingParty(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update party"); }
    finally { setBusy(false); }
  }

  async function setSiteLinkActive(site: ObligationSiteRelation, isActive: boolean) {
    setUpdatingKey(site.id);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site link");
      toast.success(isActive ? "Site link reactivated." : "Site link stood down.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site link"); }
    finally { setUpdatingKey(null); }
  }

  async function setPartyActive(party: ObligationPartyRelation, isActive: boolean) {
    const key = `${party.counterpartyId}-${party.roleCode}`;
    setUpdatingKey(key);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/parties`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", counterpartyId: party.counterpartyId, roleCode: party.roleCode, isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update party");
      toast.success(isActive ? "Party reactivated." : "Party stood down.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update party"); }
    finally { setUpdatingKey(null); }
  }

  return <>
    <AfendaSection title="Relationship graph" description="The obligation may span many sites and involve many counterparties in distinct roles." actions={isAdmin ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={beginAddSite}>Link site</Button><Button size="sm" variant="outline" onClick={beginAddParty}>Link party</Button></div> : undefined}>
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="obligation-sites-title" className="rounded-lg border p-4">
          <h3 id="obligation-sites-title" className="text-sm font-semibold">Sites</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Where this commitment applies operationally.</p>
          {sites.length === 0 ? <div className="mt-4"><AfendaEmptyState compact title="No sites linked" description="Link one or more locations so the obligation appears in site context." /></div> : <ul className="mt-4 divide-y">{sites.map((site) => <li key={site.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><Link href={`/admin/corporate/sites/${site.id}`} className="font-medium underline-offset-4 hover:underline">{site.name}</Link><p className="font-mono text-xs text-muted-foreground">{site.code} · {site.type.replaceAll("_", " ")}</p></div><div className="flex flex-col items-end gap-2"><div className="flex flex-wrap items-center justify-end gap-1">{site.scopeRole ? <Badge variant="outline">{site.scopeRole.replaceAll("_", " ")}</Badge> : null}<Badge variant={site.isActive ? "default" : "secondary"}>{site.isActive ? "Active" : "Inactive"}</Badge></div>{isAdmin ? <div className="flex flex-wrap justify-end gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEditSite(site)}>Edit</Button>
    {site.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Stand down this site link?" description="The link stays in history but the obligation no longer counts as applying at this site." confirmLabel="Stand down" onConfirm={() => setSiteLinkActive(site, false)} busy={updatingKey === site.id}>Stand down</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingKey === site.id} onClick={() => void setSiteLinkActive(site, true)}>Reactivate</Button>}
  </div> : null}</div></li>)}</ul>}
        </section>

        <section aria-labelledby="obligation-parties-title" className="rounded-lg border p-4">
          <h3 id="obligation-parties-title" className="text-sm font-semibold">Parties</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Who participates and in what role.</p>
          {parties.length === 0 ? <div className="mt-4"><AfendaEmptyState compact title="No parties linked" description="The primary compatibility party will be backfilled by the migration; add other roles here." /></div> : <ul className="mt-4 divide-y">{parties.map((party) => <li key={`${party.counterpartyId}-${party.roleCode}`} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><Link href={`/admin/corporate/counterparties/${party.counterpartyId}`} className="font-medium underline-offset-4 hover:underline">{party.name}</Link><p className="font-mono text-xs text-muted-foreground">{party.code}</p></div><div className="flex flex-col items-end gap-2"><div className="flex flex-wrap items-center justify-end gap-1"><Badge variant="secondary">{party.roleCode.replaceAll("_", " ")}</Badge>{party.isPrimary ? <Badge variant="outline">Primary</Badge> : null}<Badge variant={party.isActive ? "default" : "secondary"}>{party.isActive ? "Active" : "Inactive"}</Badge></div>{isAdmin ? <div className="flex flex-wrap justify-end gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEditParty(party)}>Edit</Button>
    {party.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Stand down this party?" description="The link stays in history but the obligation no longer counts this counterparty as an active party." confirmLabel="Stand down" onConfirm={() => setPartyActive(party, false)} busy={updatingKey === `${party.counterpartyId}-${party.roleCode}`}>Stand down</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingKey === `${party.counterpartyId}-${party.roleCode}`} onClick={() => void setPartyActive(party, true)}>Reactivate</Button>}
  </div> : null}</div></li>)}</ul>}
        </section>
      </div>
    </AfendaSection>

    <AfendaResponsiveOverlay open={siteOpen} onOpenChange={setSiteOpen} title="Link site" description="Relate this obligation to a location. The same obligation can span multiple sites." footer={<><Button variant="outline" onClick={() => setSiteOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void addSite()} disabled={busy || !siteId}>{busy ? "Linking…" : "Link site"}</Button></>}>
      <div className="grid gap-4">
        <AfendaField label="Site" id="obligation-site" required><Select value={siteId} onValueChange={setSiteId}><SelectTrigger id="obligation-site" className="w-full"><SelectValue placeholder="Select site" /></SelectTrigger><SelectContent><SelectGroup>{siteOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectGroup></SelectContent></Select></AfendaField>
        <AfendaField label="Scope / role at site" id="obligation-site-role"><Input id="obligation-site-role" value={scopeRole} onChange={(e) => setScopeRole(e.target.value.toUpperCase())} placeholder="e.g. COVERED_SITE / BILLING_SITE" /></AfendaField>
        <AfendaField label="Notes" id="obligation-site-notes"><Textarea id="obligation-site-notes" value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={partyOpen} onOpenChange={setPartyOpen} title="Link counterparty role" description="Add another party without replacing the existing primary counterparty compatibility field." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setPartyOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void addParty()} disabled={busy || !counterpartyId || !roleCode}>{busy ? "Linking…" : "Link party"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AfendaField label="Counterparty" id="obligation-party" required className="sm:col-span-2"><Select value={counterpartyId} onValueChange={setCounterpartyId}><SelectTrigger id="obligation-party" className="w-full"><SelectValue placeholder="Select counterparty" /></SelectTrigger><SelectContent><SelectGroup>{counterpartyOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectGroup></SelectContent></Select></AfendaField>
        <AfendaField label="Role" id="obligation-party-role" required><Input id="obligation-party-role" list="obligation-party-roles" value={roleCode} onChange={(e) => setRoleCode(e.target.value.toUpperCase())} /><datalist id="obligation-party-roles">{OBLIGATION_PARTY_ROLE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></AfendaField>
        <div className="sm:pt-1"><AfendaCheckField label="Primary role" checked={isPrimary} onChange={setIsPrimary} /></div>
        <AfendaField label="Effective from" id="obligation-party-from"><Input id="obligation-party-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></AfendaField>
        <AfendaField label="Effective to" id="obligation-party-to"><Input id="obligation-party-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /></AfendaField>
        <AfendaField label="Notes" id="obligation-party-notes" className="sm:col-span-2"><Textarea id="obligation-party-notes" value={partyNotes} onChange={(e) => setPartyNotes(e.target.value)} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={editingSite !== null} onOpenChange={(next) => !next && setEditingSite(null)} title={editingSite ? `Edit ${editingSite.name}` : "Edit site link"} description="Correct this site link's scope role or notes. To change the site, stand this link down and link a new one." footer={<><Button variant="outline" onClick={() => setEditingSite(null)} disabled={busy}>Cancel</Button><Button onClick={() => void saveSiteLink()} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></>}>
      <div className="grid gap-4">
        <AfendaField label="Scope / role at site" id="obligation-site-edit-role"><Input id="obligation-site-edit-role" value={scopeRole} onChange={(e) => setScopeRole(e.target.value.toUpperCase())} placeholder="e.g. COVERED_SITE / BILLING_SITE" /></AfendaField>
        <AfendaField label="Notes" id="obligation-site-edit-notes"><Textarea id="obligation-site-edit-notes" value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={editingParty !== null} onOpenChange={(next) => !next && setEditingParty(null)} title={editingParty ? `Edit ${editingParty.name}` : "Edit party"} description="Correct this party's role period or primary flag. To change the counterparty or the role code, stand this one down and link a new party." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setEditingParty(null)} disabled={busy}>Cancel</Button><Button onClick={() => void savePartyLink()} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:pt-1"><AfendaCheckField label="Primary role" checked={isPrimary} onChange={setIsPrimary} /></div>
        <AfendaField label="Effective from" id="obligation-party-edit-from"><Input id="obligation-party-edit-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></AfendaField>
        <AfendaField label="Effective to" id="obligation-party-edit-to"><Input id="obligation-party-edit-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /></AfendaField>
        <AfendaField label="Notes" id="obligation-party-edit-notes" className="sm:col-span-2"><Textarea id="obligation-party-edit-notes" value={partyNotes} onChange={(e) => setPartyNotes(e.target.value)} /></AfendaField>
      </div>
    </AfendaResponsiveOverlay>
  </>;
}

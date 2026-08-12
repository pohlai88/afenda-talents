"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

export type ObligationSiteRelation = { id: string; code: string; name: string; type: string; scopeRole: string | null };
export type ObligationPartyRelation = { counterpartyId: string; code: string; name: string; roleCode: string; isPrimary: boolean; effectiveFrom: string | null; effectiveTo: string | null };

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

  async function addSite() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/sites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, scopeRole: scopeRole || null, notes: siteNotes || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not link site");
      toast.success("Site linked to obligation."); setSiteOpen(false); setSiteId(""); setScopeRole(""); setSiteNotes(""); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not link site"); }
    finally { setBusy(false); }
  }

  async function addParty() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/parties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ counterpartyId, roleCode, isPrimary, effectiveFrom: effectiveFrom || null, effectiveTo: effectiveTo || null, notes: partyNotes || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not link counterparty role");
      toast.success("Counterparty role linked."); setPartyOpen(false); setCounterpartyId(""); setRoleCode("SERVICE_PROVIDER"); setIsPrimary(false); setEffectiveFrom(""); setEffectiveTo(""); setPartyNotes(""); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not link counterparty role"); }
    finally { setBusy(false); }
  }

  return <>
    <AfendaSection title="Relationship graph" description="The obligation may span many sites and involve many counterparties in distinct roles." actions={isAdmin ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSiteOpen(true)}>Link site</Button><Button size="sm" variant="outline" onClick={() => setPartyOpen(true)}>Link party</Button></div> : undefined}>
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="obligation-sites-title" className="rounded-lg border p-4">
          <h3 id="obligation-sites-title" className="text-sm font-semibold">Sites</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Where this commitment applies operationally.</p>
          {sites.length === 0 ? <div className="mt-4"><AfendaEmptyState compact title="No sites linked" description="Link one or more locations so the obligation appears in site context." /></div> : <ul className="mt-4 divide-y">{sites.map((site) => <li key={site.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><Link href={`/admin/corporate/sites/${site.id}`} className="font-medium underline-offset-4 hover:underline">{site.name}</Link><p className="font-mono text-xs text-muted-foreground">{site.code} · {site.type.replaceAll("_", " ")}</p></div>{site.scopeRole ? <Badge variant="outline">{site.scopeRole.replaceAll("_", " ")}</Badge> : null}</li>)}</ul>}
        </section>

        <section aria-labelledby="obligation-parties-title" className="rounded-lg border p-4">
          <h3 id="obligation-parties-title" className="text-sm font-semibold">Parties</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Who participates and in what role.</p>
          {parties.length === 0 ? <div className="mt-4"><AfendaEmptyState compact title="No parties linked" description="The primary compatibility party will be backfilled by the migration; add other roles here." /></div> : <ul className="mt-4 divide-y">{parties.map((party) => <li key={`${party.counterpartyId}-${party.roleCode}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><Link href={`/admin/corporate/counterparties/${party.counterpartyId}`} className="font-medium underline-offset-4 hover:underline">{party.name}</Link><p className="font-mono text-xs text-muted-foreground">{party.code}</p></div><div className="flex flex-wrap items-center gap-1"><Badge variant="secondary">{party.roleCode.replaceAll("_", " ")}</Badge>{party.isPrimary ? <Badge variant="outline">Primary</Badge> : null}</div></li>)}</ul>}
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
  </>;
}

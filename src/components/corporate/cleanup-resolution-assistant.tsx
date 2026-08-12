"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { CleanupResolutionPlan, CleanupResolutionRequest } from "@/lib/corporate-admin/cleanup-resolution";

export type ContactResolutionGroup = {
  counterpartyId: string; code: string; name: string;
  contacts: Array<{ id:string; name:string; email:string|null; role:string|null; isPrimary:boolean; isActive:boolean }>;
};
export type CoverageResolutionGroup = {
  siteId:string; code:string; name:string; serviceCategory:string;
  coverage:Array<{ id:string; counterparty:string; roleCode:string|null; isPrimary:boolean; isActive:boolean }>;
};
export type ObligationPartyResolutionGroup = {
  obligationId:string; code:string; title:string; legacyCounterpartyId:string;
  parties:Array<{ counterpartyId:string; counterparty:string; roleCode:string; isPrimary:boolean }>;
};

type Props = { contacts:ContactResolutionGroup[]; coverage:CoverageResolutionGroup[]; obligations:ObligationPartyResolutionGroup[] };

export function CleanupResolutionAssistant({contacts,coverage,obligations}:Props) {
  const router=useRouter();
  const [request,setRequest]=useState<CleanupResolutionRequest|null>(null);
  const [plan,setPlan]=useState<CleanupResolutionPlan|null>(null);
  const [busy,setBusy]=useState(false);

  async function preview(next:CleanupResolutionRequest){setRequest(next);setBusy(true);try{const response=await fetch("/api/admin/corporate/data-quality/cleanup/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Could not preview cleanup");setPlan(data as CleanupResolutionPlan);}catch(error){setPlan(null);toast.error(error instanceof Error?error.message:"Could not preview cleanup");}finally{setBusy(false);}}
  async function commit(){if(!request||!plan)return;setBusy(true);try{const response=await fetch("/api/admin/corporate/data-quality/cleanup/commit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request,previewHash:plan.previewHash})});const data=await response.json().catch(()=>({}));if(!response.ok){if(response.status===409)setPlan(null);throw new Error(typeof data.error==="string"?data.error:"Could not commit cleanup");}toast.success("Cleanup resolution committed.");setPlan(null);setRequest(null);router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Could not commit cleanup");}finally{setBusy(false);}}

  return <div className="flex flex-col gap-5">
    {plan?<Card className="border-amber-300"><CardHeader><CardTitle>Resolution preview</CardTitle><CardDescription>Review the exact before → after changes. Nothing below has been written yet.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><div className="flex flex-wrap gap-2"><Badge>{plan.action}</Badge><Badge variant="outline">{plan.subject.label}</Badge></div>{plan.changes.length?<ul className="flex flex-col gap-1 text-sm">{plan.changes.map((change,index)=><li key={`${change.field}-${index}`}><span className="font-mono text-xs">{change.field}</span>: <span className="text-muted-foreground">{String(change.before??"—")}</span> → <strong>{String(change.after??"—")}</strong></li>)}</ul>:<p className="text-sm text-muted-foreground">No changes are required.</p>}<div>{plan.changes.length?<AfendaConfirmButton busy={busy} title="Commit this cleanup resolution?" description="Afenda will re-build this plan inside the transaction. A stale plan is rejected and must be previewed again." confirmLabel="Commit resolution" onConfirm={commit}>Commit reviewed resolution</AfendaConfirmButton>:<Button disabled>No changes</Button>}</div></CardContent></Card>:null}

    <Card><CardHeader><CardTitle>Counterparty contact resolution</CardTitle><CardDescription>Choose one active primary Contact or deactivate a known duplicate after primary responsibility is settled.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{contacts.length===0?<p className="text-sm text-muted-foreground">No current contact conflicts require guided resolution.</p>:contacts.map(group=><div key={group.counterpartyId} className="rounded-lg border p-4"><div className="mb-3"><div className="font-semibold">{group.name}</div><div className="font-mono text-xs text-muted-foreground">{group.code}</div></div><RadioGroup onValueChange={id=>void preview({action:"SET_PRIMARY_CONTACT",counterpartyId:group.counterpartyId,contactId:id})}>{group.contacts.map(contact=><div key={contact.id} className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0"><div className="flex min-w-0 items-center gap-3"><RadioGroupItem value={contact.id} id={`contact-${contact.id}`} disabled={!contact.isActive}/><Label htmlFor={`contact-${contact.id}`} className="min-w-0"><span className="block truncate">{contact.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{contact.email??"No email"}{contact.role?` · ${contact.role}`:""}</span></Label></div><div className="flex items-center gap-2">{contact.isPrimary?<Badge>Primary</Badge>:null}{!contact.isActive?<Badge variant="outline">Inactive</Badge>:null}{contact.isActive&&!contact.isPrimary?<Button size="sm" variant="outline" onClick={()=>void preview({action:"DEACTIVATE_CONTACT",counterpartyId:group.counterpartyId,contactId:contact.id})}>Deactivate</Button>:null}</div></div>)}</RadioGroup></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle>Service-provider resolution</CardTitle><CardDescription>Choose one primary provider for each Site/service category or deactivate a confirmed duplicate after the primary is settled.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{coverage.length===0?<p className="text-sm text-muted-foreground">No current service-provider conflicts require guided resolution.</p>:coverage.map(group=><div key={`${group.siteId}:${group.serviceCategory}`} className="rounded-lg border p-4"><div className="mb-3"><div className="font-semibold">{group.name} · {group.serviceCategory}</div><div className="font-mono text-xs text-muted-foreground">{group.code}</div></div><RadioGroup onValueChange={id=>void preview({action:"SET_PRIMARY_COVERAGE",siteId:group.siteId,coverageId:id})}>{group.coverage.map(item=><div key={item.id} className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0"><div className="flex min-w-0 items-center gap-3"><RadioGroupItem value={item.id} id={`coverage-${item.id}`} disabled={!item.isActive}/><Label htmlFor={`coverage-${item.id}`}><span className="block">{item.counterparty}</span><span className="text-xs font-normal text-muted-foreground">{item.roleCode??"No role"}</span></Label></div><div className="flex items-center gap-2">{item.isPrimary?<Badge>Primary</Badge>:null}{!item.isActive?<Badge variant="outline">Inactive</Badge>:null}{item.isActive&&!item.isPrimary?<Button size="sm" variant="outline" onClick={()=>void preview({action:"DEACTIVATE_COVERAGE",siteId:group.siteId,coverageId:item.id})}>Deactivate</Button>:null}</div></div>)}</RadioGroup></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle>Primary Obligation Party resolution</CardTitle><CardDescription>Choose the authoritative primary party. Commit also synchronizes the legacy primary counterparty field so the graph and compatibility path cannot drift.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{obligations.length===0?<p className="text-sm text-muted-foreground">No current primary-party conflicts require guided resolution.</p>:obligations.map(group=><div key={group.obligationId} className="rounded-lg border p-4"><div className="mb-3"><div className="font-semibold">{group.title}</div><div className="font-mono text-xs text-muted-foreground">{group.code}</div></div><RadioGroup onValueChange={value=>{const [counterpartyId,...roleParts]=value.split("::");void preview({action:"SET_PRIMARY_OBLIGATION_PARTY",obligationId:group.obligationId,counterpartyId,roleCode:roleParts.join("::")});}}>{group.parties.map(party=><div key={`${party.counterpartyId}:${party.roleCode}`} className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0"><div className="flex items-center gap-3"><RadioGroupItem value={`${party.counterpartyId}::${party.roleCode}`} id={`party-${group.obligationId}-${party.counterpartyId}-${party.roleCode}`}/><Label htmlFor={`party-${group.obligationId}-${party.counterpartyId}-${party.roleCode}`}><span className="block">{party.counterparty}</span><span className="text-xs font-normal text-muted-foreground">{party.roleCode}</span></Label></div><div className="flex items-center gap-2">{party.isPrimary?<Badge>Graph primary</Badge>:null}{party.counterpartyId===group.legacyCounterpartyId?<Badge variant="outline">Compatibility primary</Badge>:null}</div></div>)}</RadioGroup></div>)}</CardContent></Card>
  </div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RELATIONAL_IMPORT_HEADERS, parseRelationalImportText, type RelationalImportRow, type RelationalImportTarget } from "@/lib/corporate-admin/relational-import";

type Change = { field:string; before:string|boolean|null; after:string|boolean|null };
type PreviewRow = { rowNumber:number; key:string; action:"CREATE"|"UPDATE"|"NO_CHANGE"|"CONFLICT"|"ERROR"; recordId:string|null; changes:Change[]; errors:string[] };
type Preview = { target:RelationalImportTarget; rows:PreviewRow[]; previewHash:string; summary:{create:number;update:number;noChange:number;conflict:number;error:number} };
type CommitResult = { target:RelationalImportTarget; created:number; updated:number; noChange:number };

const CONFIG: Record<RelationalImportTarget,{label:string;description:string;example:string}> = {
  CONTACT: { label:"Counterparty Contacts", description:"Keyed by Counterparty code + email. Email is required so updates are deterministic.", example:"CP-CLEANPRO\tOperations Manager\tops@cleanpro.example\tManager\tOperations\t+60312345678\t+60123456789\tSERVICE\tno\tyes\tMain operating contact" },
  SERVICE_COVERAGE: { label:"Service Coverage", description:"Keyed by Site + Counterparty + service category + role. Competing primary providers are conflicts.", example:"SITE-KLG-HQ\tCP-CLEANPRO\tCLEANING\tPRIMARY_PROVIDER\t2026-01-01\t2026-12-31\tyes\tyes\tWeekly cleaning\t+60123456789\tHQ cleaning coverage" },
  OBLIGATION_SITE: { label:"Obligation ↔ Site", description:"Links agreements to the Sites they govern. Existing links are updated, not duplicated.", example:"ADM-2026-TA001\tSITE-KLG-HQ\tPREMISES\tMain tenancy premises" },
  OBLIGATION_PARTY: { label:"Obligation ↔ Party", description:"Links counterparties to agreements by business role. Competing primary parties are conflicts.", example:"ADM-2026-TA001\tCP-LANDLORD\tLANDLORD\tyes\t2026-01-01\t2026-12-31\tPrimary landlord" },
};

function actionBadge(action:PreviewRow["action"]){
  if(action==="ERROR")return <Badge variant="destructive">Error</Badge>;
  if(action==="CONFLICT")return <Badge variant="destructive">Conflict</Badge>;
  if(action==="CREATE")return <Badge>Create</Badge>;
  if(action==="UPDATE")return <Badge variant="secondary">Update</Badge>;
  return <Badge variant="outline">No change</Badge>;
}

export function RelationalImportAssistant({target}:{target:RelationalImportTarget}){
  const router=useRouter();
  const config=CONFIG[target];
  const template=`${RELATIONAL_IMPORT_HEADERS[target].join("\t")}\n${config.example}`;
  const [text,setText]=useState(template);
  const [rows,setRows]=useState<RelationalImportRow[]>([]);
  const [errors,setErrors]=useState<string[]>([]);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [committed,setCommitted]=useState<CommitResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [fileName,setFileName]=useState<string|null>(null);
  const canCommit=Boolean(preview&&preview.summary.error===0&&preview.summary.conflict===0&&(preview.summary.create>0||preview.summary.update>0));

  function reset(){setPreview(null);setCommitted(null);}
  function parse(){const result=parseRelationalImportText(target,text);setRows(result.rows);setErrors(result.errors);reset();if(!result.errors.length)toast.success(`${result.rows.length} relationship row${result.rows.length===1?"":"s"} parsed.`);}
  async function loadFile(file:File){const ext=file.name.split(".").pop()?.toLowerCase();if(!["csv","tsv","txt"].includes(ext??"")){toast.error("Use CSV or TSV for relational imports.");return;}if(file.size>2_000_000){toast.error("Import files are limited to 2 MB.");return;}setText(await file.text());setFileName(file.name);setRows([]);setErrors([]);reset();}
  async function copyTemplate(){try{await navigator.clipboard.writeText(template);toast.success(`${config.label} template copied.`);}catch{toast.error("Clipboard access was unavailable.");}}
  async function doPreview(){setBusy(true);try{const response=await fetch("/api/admin/corporate/operations/import/relations/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target,rows})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Could not preview import");setPreview(data as Preview);setCommitted(null);}catch(error){toast.error(error instanceof Error?error.message:"Could not preview import");}finally{setBusy(false);}}
  async function commit(){if(!preview)return;setBusy(true);try{const response=await fetch("/api/admin/corporate/operations/import/relations/commit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target,rows,previewHash:preview.previewHash})});const data=await response.json().catch(()=>({}));if(!response.ok){if(response.status===409)setPreview(null);throw new Error(typeof data.error==="string"?data.error:"Could not commit import");}setCommitted(data.result);toast.success(`${config.label} import committed.`);router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Could not commit import");}finally{setBusy(false);}}
  async function reconciliation(){if(!preview||!committed)return;const header=["row","relationship_key","decision","field","before","after"];const records=preview.rows.flatMap(row=>row.changes.length?row.changes.map(change=>[row.rowNumber,row.key,row.action,change.field,change.before??"",change.after??""]):[[row.rowNumber,row.key,row.action,"","",""]]);const tsv=[header,...records].map(r=>r.map(v=>String(v).replaceAll("\t"," ").replaceAll("\n"," ")).join("\t")).join("\n");try{await navigator.clipboard.writeText(tsv);toast.success("Relationship reconciliation report copied.");}catch{toast.error("Clipboard access was unavailable.");}}

  return <div className="flex flex-col gap-5">
    <Card><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>1. Paste or load {config.label}</CardTitle><CardDescription>{config.description}</CardDescription></div><Button variant="outline" onClick={()=>void copyTemplate()}>Copy template</Button></CardHeader><CardContent className="flex flex-col gap-3"><div className="flex flex-col gap-2 rounded-lg border p-3"><label htmlFor={`rel-import-${target}`} className="text-sm font-medium">Load CSV / TSV</label><Input id={`rel-import-${target}`} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={event=>{const file=event.target.files?.[0];if(file)void loadFile(file);}}/><p className="text-xs text-muted-foreground">{fileName?`Loaded: ${fileName}`:"Up to 2 MB / 200 rows. Relationship endpoints must already exist."}</p></div><Textarea value={text} onChange={event=>{setText(event.target.value);setFileName(null);reset();}} className="min-h-52 font-mono text-xs" spellCheck={false}/><Button className="self-start" onClick={parse}>Parse relationships</Button></CardContent></Card>

    <Card><CardHeader><CardTitle>2. Resolve & review</CardTitle><CardDescription>Afenda resolves both sides of every relationship and blocks ambiguous natural keys or competing primary assignments.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{errors.length?<Alert variant="destructive"><AlertTitle>Fix the input</AlertTitle><AlertDescription><ul className="list-disc pl-5">{errors.map(error=><li key={error}>{error}</li>)}</ul></AlertDescription></Alert>:rows.length?<div className="flex items-center gap-3"><Badge>{rows.length} parsed</Badge><Button variant="outline" disabled={busy} onClick={()=>void doPreview()}>Preview against Afenda</Button></div>:<AfendaEmptyState compact title="Not parsed yet" description="Parse the relationship data before Afenda resolves current records."/>}
      {preview?<><div className="grid gap-3 sm:grid-cols-5">{[["Create",preview.summary.create],["Update",preview.summary.update],["No change",preview.summary.noChange],["Conflicts",preview.summary.conflict],["Errors",preview.summary.error]].map(([label,value])=><div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>{preview.summary.conflict?<Alert variant="destructive"><AlertTitle>Relationship conflicts require review</AlertTitle><AlertDescription>Afenda found ambiguous duplicates or competing primary relationships. It will not choose a winner automatically.</AlertDescription></Alert>:null}<div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Natural key</TableHead><TableHead>Decision</TableHead><TableHead>Changes / findings</TableHead></TableRow></TableHeader><TableBody>{preview.rows.map(row=><TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell className="font-mono text-xs">{row.key}</TableCell><TableCell>{actionBadge(row.action)}</TableCell><TableCell>{row.errors.length?<ul className="list-disc pl-4 text-sm text-destructive">{row.errors.map(error=><li key={error}>{error}</li>)}</ul>:row.changes.length?<ul className="flex flex-col gap-1 text-xs">{row.changes.map((change,index)=><li key={`${change.field}-${index}`}>{change.field}: <span className="text-muted-foreground">{String(change.before??"—")}</span> → {String(change.after??"—")}</li>)}</ul>:<span className="text-muted-foreground">No changes</span>}</TableCell></TableRow>)}</TableBody></Table></div></>:null}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>3. Commit & reconcile</CardTitle><CardDescription>Commit re-runs relationship resolution inside the transaction. Any stale plan, conflict or error blocks the full batch.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{committed?<Alert><AlertTitle>Relationship import committed</AlertTitle><AlertDescription>{committed.created} created · {committed.updated} updated · {committed.noChange} unchanged.</AlertDescription></Alert>:null}<div className="flex flex-wrap gap-2">{canCommit?<AfendaConfirmButton busy={busy} title={`Commit ${config.label} import?`} description={`Commit ${preview!.summary.create} creates and ${preview!.summary.update} updates. Any stale state, conflict or error blocks the whole transaction.`} confirmLabel="Commit import" onConfirm={commit}>Commit reviewed relationships</AfendaConfirmButton>:<Button disabled>Commit reviewed relationships</Button>}{committed?<Button variant="outline" onClick={()=>void reconciliation()}>Copy reconciliation report</Button>:null}</div></CardContent></Card>
  </div>;
}

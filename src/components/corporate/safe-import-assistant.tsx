"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CORPORATE_IMPORT_HEADERS, parseCorporateImportText, type CorporateImportPreviewRow, type CorporateImportRow } from "@/lib/corporate-admin/safe-import";

type Preview = {
  rows: CorporateImportPreviewRow[];
  previewHash: string;
  summary: { create: number; update: number; noChange: number; error: number; siteLinks: number };
};

const EXAMPLE_ROW = [
  "ADM-2026-TA001", "RENT", "Monthly rent", "RENT", "15000", "MYR", "yes", "1", "MONTH",
  "2026-09-01", "2026-09-01", "yes", "14", "2026-01-01", "2026-12-31", "Main tenancy rental", "SITE-KLG-HQ",
].join("\t");
const TEMPLATE = `${CORPORATE_IMPORT_HEADERS.join("\t")}\n${EXAMPLE_ROW}`;

function actionBadge(action: CorporateImportPreviewRow["action"]) {
  if (action === "ERROR") return <Badge variant="destructive">Error</Badge>;
  if (action === "CREATE") return <Badge>Create</Badge>;
  if (action === "UPDATE") return <Badge variant="secondary">Update</Badge>;
  return <Badge variant="outline">No change</Badge>;
}

export function SafeImportAssistant() {
  const router = useRouter();
  const [text, setText] = useState(TEMPLATE);
  const [rows, setRows] = useState<CorporateImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<{ created: number; updated: number; siteLinks: number; noChange: number } | null>(null);

  const canCommit = Boolean(preview && preview.summary.error === 0 && (preview.summary.create > 0 || preview.summary.update > 0 || preview.summary.siteLinks > 0));
  const changedRows = useMemo(() => preview?.rows.filter((row) => row.action === "CREATE" || row.action === "UPDATE").length ?? 0, [preview]);

  function parse() {
    const result = parseCorporateImportText(text);
    setRows(result.rows);
    setParseErrors(result.errors);
    setPreview(null);
    setCommitted(null);
    if (result.errors.length === 0) toast.success(`${result.rows.length} row${result.rows.length === 1 ? "" : "s"} parsed.`);
  }

  async function copyTemplate() {
    try { await navigator.clipboard.writeText(TEMPLATE); toast.success("Import template copied. Paste it into Excel or Google Sheets."); }
    catch { toast.error("Clipboard access was unavailable."); }
  }

  async function previewImport() {
    if (rows.length === 0 || parseErrors.length) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/operations/import/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not preview import");
      setPreview(data as Preview);
      setCommitted(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not preview import"); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!preview || !canCommit) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/operations/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, previewHash: preview.previewHash }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) setPreview(null);
        throw new Error(typeof data.error === "string" ? data.error : "Could not commit import");
      }
      setCommitted(data.result);
      toast.success("Corporate import committed.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not commit import"); }
    finally { setBusy(false); }
  }

  return <div className="flex flex-col gap-5">
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>1. Paste from Excel or Google Sheets</CardTitle><CardDescription>Use the canonical headers. Required identifiers are obligation_code + line_code. Blank optional cells do not erase existing values during updates.</CardDescription></div>
        <Button variant="outline" onClick={() => void copyTemplate()}>Copy template</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea value={text} onChange={(event) => { setText(event.target.value); setPreview(null); setCommitted(null); }} className="min-h-56 font-mono text-xs" spellCheck={false} aria-label="Corporate import pasted table" />
        <div className="flex flex-wrap items-center gap-2"><Button onClick={parse}>Parse pasted data</Button><span className="text-xs text-muted-foreground">TSV from spreadsheet paste is preferred; CSV is also accepted.</span></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>2. Parse & validate shape</CardTitle><CardDescription>Afenda checks headers, row limits, booleans, numbers, dates and identifier shape before querying Corporate records.</CardDescription></CardHeader>
      <CardContent>
        {parseErrors.length ? <Alert variant="destructive"><AlertTitle>Fix the pasted data</AlertTitle><AlertDescription><ul className="list-disc pl-5">{parseErrors.map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert> : rows.length ? <div className="flex flex-wrap items-center gap-3"><Badge>{rows.length} parsed</Badge><Button variant="outline" disabled={busy} onClick={() => void previewImport()}>Preview against Afenda</Button></div> : <AfendaEmptyState compact title="Not parsed yet" description="Paste a spreadsheet range, then parse it before Afenda resolves any records." />}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>3. Review exact changes</CardTitle><CardDescription>Preview resolves agreement codes, Agreement Lines and Site codes against current data. Nothing below has been written.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!preview ? <AfendaEmptyState compact title="Preview required" description="Run Preview against Afenda to see CREATE / UPDATE / NO CHANGE / ERROR decisions." /> : <>
          <div className="grid gap-3 sm:grid-cols-5">
            {[['Create', preview.summary.create], ['Update', preview.summary.update], ['No change', preview.summary.noChange], ['Errors', preview.summary.error], ['Site links', preview.summary.siteLinks]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}
          </div>
          {preview.summary.error > 0 ? <Alert variant="destructive"><AlertTitle>Commit blocked</AlertTitle><AlertDescription>Resolve every error and preview again. Afenda never commits valid rows while silently skipping invalid rows.</AlertDescription></Alert> : null}
          <div className="overflow-x-auto rounded-lg border">
            <Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Agreement</TableHead><TableHead>Line</TableHead><TableHead>Decision</TableHead><TableHead>Changes / validation</TableHead></TableRow></TableHeader>
              <TableBody>{preview.rows.map((row) => <TableRow key={row.rowNumber}><TableCell className="font-mono text-xs">{row.rowNumber}</TableCell><TableCell className="font-mono text-xs">{row.obligationCode}</TableCell><TableCell className="font-mono text-xs">{row.lineCode}</TableCell><TableCell>{actionBadge(row.action)}</TableCell><TableCell className="min-w-80">{row.errors.length ? <ul className="list-disc pl-4 text-sm text-destructive">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul> : row.changes.length ? <ul className="flex flex-col gap-1 text-xs">{row.changes.map((change, index) => <li key={`${change.field}-${index}`}><span className="font-medium">{change.field}</span>: <span className="text-muted-foreground">{String(change.before ?? "—")}</span> → {String(change.after ?? "—")}</li>)}</ul> : <span className="text-sm text-muted-foreground">No changes</span>}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>4. Explicit commit</CardTitle><CardDescription>The server re-derives the preview inside the transaction. If Corporate data changed since preview, the commit is rejected and you must preview again.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {committed ? <Alert><AlertTitle>Import committed</AlertTitle><AlertDescription>{committed.created} created · {committed.updated} updated · {committed.siteLinks} Site links · {committed.noChange} unchanged.</AlertDescription></Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          {canCommit ? <AfendaConfirmButton busy={busy} title="Commit this Corporate import?" description={`This will commit ${preview!.summary.create} creates, ${preview!.summary.update} updates and ${preview!.summary.siteLinks} Site links from ${changedRows} changed rows. The entire transaction is rejected if the preview is stale or any row is invalid.`} confirmLabel="Commit import" onConfirm={commitImport}>Commit reviewed import</AfendaConfirmButton> : <Button disabled>Commit reviewed import</Button>}
          <span className="text-xs text-muted-foreground">No row-level partial success. One invalid/stale plan blocks the transaction.</span>
        </div>
      </CardContent>
    </Card>
  </div>;
}

"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AfendaField } from "@/components/afenda/form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TEMPLATE_HEADERS = [
  "obligation_code",
  "line_code",
  "due_date",
  "period_label",
  "expected_amount",
  "currency",
  "paid_amount",
  "payment_date",
  "payment_method",
  "payment_reference",
  "payment_proof_url",
  "reconciled",
  "notes",
] as const;

const TEMPLATE = `${TEMPLATE_HEADERS.join(",")}\nADM-2026-ABC123,GENERAL,2026-07-01,2026-07,17235.60,MYR,17235.60,2026-07-03,BANK_TRANSFER,TXN-001,,false,Historical July rent\n`;

type ParsedRow = Record<string, string>;
type ImportResult = {
  summary: { imported: number; duplicate: number; error: number };
  rows: Array<{ rowNumber: number; status: "IMPORTED" | "DUPLICATE" | "ERROR"; error?: string }>;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function bool(value: string): boolean {
  return ["1", "true", "yes", "y", "reconciled"].includes(value.trim().toLowerCase());
}

function toPayload(row: ParsedRow) {
  return {
    obligationCode: row.obligation_code || null,
    lineCode: row.line_code || null,
    dueDate: row.due_date || null,
    periodLabel: row.period_label || null,
    expectedAmount: numberOrNull(row.expected_amount ?? ""),
    currency: row.currency || null,
    paidAmount: numberOrNull(row.paid_amount ?? ""),
    paymentDate: row.payment_date || "",
    paymentMethod: row.payment_method || "",
    paymentReference: row.payment_reference || null,
    paymentProofUrl: row.payment_proof_url || null,
    reconciled: bool(row.reconciled ?? ""),
    notes: row.notes || null,
  };
}

export function PaymentHistoryImport() {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const rows = useMemo(() => parseCsv(csv), [csv]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    try {
      setCsv(await file.text());
      setResult(null);
    } catch {
      toast.error("Could not read the CSV file.");
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "corporate-payment-history-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importRows() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/payments/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "CSV_IMPORT", rows: rows.map(toPayload) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.rows) throw new Error(typeof data.error === "string" ? data.error : "Import failed");
      setResult(data as ImportResult);
      const summary = (data as ImportResult).summary;
      if (summary.imported > 0) toast.success(`${summary.imported} historical payment row(s) imported.`);
      else if (summary.duplicate > 0) toast.info("All matched rows were already recorded.");
      else toast.error("No payment rows were imported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={downloadTemplate}>Download CSV template</Button>
        <label className="inline-flex cursor-pointer items-center">
          <Input className="max-w-xs" type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} />
        </label>
      </div>

      <AfendaField
        label="Payment history CSV"
        id="payment-history-csv"
        guidance="Upload a CSV or paste rows here. Rows are matched by obligation_code + line_code + due_date. If a due item is missing, the importer can create it using expected_amount/currency or the line defaults. Valid rows commit even when other rows contain errors."
      >
        <Textarea id="payment-history-csv" className="min-h-64 font-mono text-xs" value={csv} onChange={(event) => { setCsv(event.target.value); setResult(null); }} placeholder={TEMPLATE} />
      </AfendaField>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="text-sm">
          <span className="font-medium">{rows.length}</span> data row(s) detected
          <span className="ml-2 text-muted-foreground">Maximum 1,000 rows per import.</span>
        </div>
        <Button disabled={busy || rows.length === 0 || rows.length > 1_000} onClick={() => void importRows()}>{busy ? "Importing…" : "Import valid rows"}</Button>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Obligation</th><th className="px-3 py-2">Line</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Paid</th><th className="px-3 py-2">Payment date</th><th className="px-3 py-2">Reference</th></tr></thead>
            <tbody>{rows.slice(0, 20).map((row, index) => <tr key={`${index}-${row.payment_reference ?? ""}`} className="border-t"><td className="px-3 py-2 tabular-nums">{index + 1}</td><td className="px-3 py-2">{row.obligation_code || "—"}</td><td className="px-3 py-2">{row.line_code || "—"}</td><td className="px-3 py-2 tabular-nums">{row.due_date || "—"}</td><td className="px-3 py-2 tabular-nums">{row.paid_amount || "—"}</td><td className="px-3 py-2 tabular-nums">{row.payment_date || "—"}</td><td className="px-3 py-2">{row.payment_reference || "—"}</td></tr>)}</tbody>
          </table>
          {rows.length > 20 ? <p className="border-t px-3 py-2 text-xs text-muted-foreground">Showing first 20 rows of {rows.length}.</p> : null}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap gap-4 text-sm"><span><strong>{result.summary.imported}</strong> imported</span><span><strong>{result.summary.duplicate}</strong> duplicate</span><span><strong>{result.summary.error}</strong> error</span></div>
          {result.rows.some((row) => row.status === "ERROR") ? <ul className="mt-3 space-y-1 text-xs text-destructive">{result.rows.filter((row) => row.status === "ERROR").map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.error ?? "Invalid row"}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}

import { z } from "zod";

export const CORPORATE_IMPORT_HEADERS = [
  "obligation_code", "line_code", "line_name", "line_type", "expected_amount", "currency", "recurring",
  "recurrence_interval", "recurrence_unit", "first_due_date", "next_due_date", "invoice_required", "payment_terms_days",
  "start_date", "end_date", "notes", "site_codes",
] as const;

type ImportHeader = (typeof CORPORATE_IMPORT_HEADERS)[number];

export const CORPORATE_IMPORT_HEADER_ALIASES: Record<string, ImportHeader> = {
  agreement_code: "obligation_code", contract_code: "obligation_code", component_code: "line_code", charge_code: "line_code",
  component_name: "line_name", charge_name: "line_name", component_type: "line_type", charge_type: "line_type", amount: "expected_amount",
  is_recurring: "recurring", interval: "recurrence_interval", frequency_unit: "recurrence_unit", first_due: "first_due_date",
  due_date: "next_due_date", next_due: "next_due_date", requires_invoice: "invoice_required", payment_terms: "payment_terms_days",
  effective_from: "start_date", effective_to: "end_date", memo: "notes", remark: "notes", remarks: "notes", site_code: "site_codes", sites: "site_codes",
};

export const CORPORATE_IMPORT_CLEAR_TOKEN = "__CLEAR__";
export const CORPORATE_IMPORT_CLEARABLE_FIELDS = [
  "expectedAmount", "recurrenceInterval", "recurrenceUnit", "firstDueDate", "nextDueDate", "paymentTermsDays", "startDate", "endDate", "notes",
] as const;
export type CorporateImportClearableField = (typeof CORPORATE_IMPORT_CLEARABLE_FIELDS)[number];

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional();

export const corporateImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  obligationCode: z.string().trim().min(1).max(80),
  lineCode: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "Line code uses letters, numbers, hyphens or underscores"),
  lineName: z.string().trim().min(1).max(160).optional(),
  lineType: z.string().trim().min(1).max(80).optional(),
  expectedAmount: z.number().min(0).max(999_999_999_999_999.99).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").optional(),
  recurring: z.boolean().optional(),
  recurrenceInterval: z.number().int().min(1).max(120).optional(),
  recurrenceUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).optional(),
  firstDueDate: optionalDate,
  nextDueDate: optionalDate,
  invoiceRequired: z.boolean().optional(),
  paymentTermsDays: z.number().int().min(0).max(3650).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: z.string().trim().max(10_000).optional(),
  siteCodes: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  clearFields: z.array(z.enum(CORPORATE_IMPORT_CLEARABLE_FIELDS)).max(CORPORATE_IMPORT_CLEARABLE_FIELDS.length).default([]),
}).strict();

export const corporateImportPayloadSchema = z.object({ rows: z.array(corporateImportRowSchema).min(1).max(200) }).strict();
export const corporateImportCommitSchema = corporateImportPayloadSchema.extend({ previewHash: z.string().regex(/^[0-9a-f]{64}$/) });
export type CorporateImportRow = z.infer<typeof corporateImportRowSchema>;
export type CorporateImportPayload = z.infer<typeof corporateImportPayloadSchema>;
export type CorporateImportChange = { field: string; before: string | number | boolean | null; after: string | number | boolean | null; destructive?: boolean };
export type CorporateImportPreviewRow = {
  rowNumber: number; obligationCode: string; lineCode: string; action: "CREATE" | "UPDATE" | "NO_CHANGE" | "ERROR";
  lineId: string | null; obligationId: string | null; changes: CorporateImportChange[]; siteCodes: string[]; errors: string[];
};

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
    else if (char === delimiter && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim()); return values;
}

function normalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CORPORATE_IMPORT_HEADER_ALIASES[normalized] ?? normalized;
}
function isClear(value?: string): boolean { return value?.trim().toUpperCase() === CORPORATE_IMPORT_CLEAR_TOKEN; }
function bool(value?: string): boolean | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  throw new Error(`Invalid boolean \"${value}\"`);
}
function number(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number \"${value}\"`);
  return parsed;
}

export function parseCorporateImportText(text: string): { rows: CorporateImportRow[]; errors: string[] } {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (!normalized) return { rows: [], errors: ["Paste a table with a header row first."] };
  const lines = normalized.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: ["Include a header row and at least one data row."] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const missing = ["obligation_code", "line_code"].filter((header) => !headers.includes(header));
  if (missing.length) return { rows: [], errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`] };
  const unknown = headers.filter((header) => header && !CORPORATE_IMPORT_HEADERS.includes(header as ImportHeader));
  if (unknown.length) return { rows: [], errors: [`Unknown column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`] };
  const duplicates = Array.from(new Set(headers.filter((header, index) => header && headers.indexOf(header) !== index)));
  if (duplicates.length) return { rows: [], errors: [`Multiple pasted columns map to the same Afenda field: ${duplicates.join(", ")}`] };

  const rows: CorporateImportRow[] = []; const errors: string[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitDelimitedLine(lines[index], delimiter);
    const source = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
    try {
      const clearFields: CorporateImportClearableField[] = [];
      const clear = (header: string, field: CorporateImportClearableField) => { if (isClear(source[header])) clearFields.push(field); };
      clear("expected_amount", "expectedAmount"); clear("recurrence_interval", "recurrenceInterval"); clear("recurrence_unit", "recurrenceUnit");
      clear("first_due_date", "firstDueDate"); clear("next_due_date", "nextDueDate"); clear("payment_terms_days", "paymentTermsDays");
      clear("start_date", "startDate"); clear("end_date", "endDate"); clear("notes", "notes");
      for (const header of ["line_name", "line_type", "currency", "recurring", "invoice_required", "site_codes"]) {
        if (isClear(source[header])) throw new Error(`${CORPORATE_IMPORT_CLEAR_TOKEN} is not allowed for ${header}`);
      }
      const value = (header: string) => isClear(source[header]) ? undefined : source[header];
      const candidate = {
        rowNumber: index + 1, obligationCode: source.obligation_code, lineCode: source.line_code,
        lineName: value("line_name") || undefined, lineType: value("line_type") || undefined,
        expectedAmount: number(value("expected_amount")), currency: value("currency") || undefined, recurring: bool(value("recurring")),
        recurrenceInterval: number(value("recurrence_interval")), recurrenceUnit: value("recurrence_unit") ? value("recurrence_unit")!.toUpperCase() : undefined,
        firstDueDate: value("first_due_date") || undefined, nextDueDate: value("next_due_date") || undefined,
        invoiceRequired: bool(value("invoice_required")), paymentTermsDays: number(value("payment_terms_days")),
        startDate: value("start_date") || undefined, endDate: value("end_date") || undefined, notes: value("notes") || undefined,
        siteCodes: value("site_codes") ? value("site_codes")!.split(/[;,]/).map((item) => item.trim()).filter(Boolean) : [], clearFields,
      };
      const parsed = corporateImportRowSchema.safeParse(candidate);
      if (!parsed.success) errors.push(`Row ${index + 1}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`); else rows.push(parsed.data);
    } catch (error) { errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : "Could not parse row"}`); }
  }
  return { rows, errors };
}

import { describe, expect, it } from "vitest";

import { CORPORATE_IMPORT_HEADERS, corporateImportCommitSchema, corporateImportPayloadSchema, parseCorporateImportText } from "@/lib/corporate-admin/safe-import";

describe("Corporate safe paste import", () => {
  it("parses spreadsheet TSV with typed fields", () => {
    const text = `${CORPORATE_IMPORT_HEADERS.join("\t")}\nADM-001\tRENT\tMonthly rent\tRENT\t15000\tMYR\tyes\t1\tMONTH\t2026-09-01\t2026-09-01\tyes\t14\t2026-01-01\t2026-12-31\tMain rent\tSITE-A;SITE-B`;
    const result = parseCorporateImportText(text);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ obligationCode: "ADM-001", lineCode: "RENT", expectedAmount: 15000, recurring: true, recurrenceInterval: 1, recurrenceUnit: "MONTH", invoiceRequired: true, siteCodes: ["SITE-A", "SITE-B"] });
  });

  it("requires stable identifiers", () => {
    const result = parseCorporateImportText("line_code\tline_name\nRENT\tMonthly rent");
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toContain("obligation_code");
  });

  it("rejects unknown columns rather than silently dropping data", () => {
    const result = parseCorporateImportText("obligation_code\tline_code\tmystery\nADM-001\tRENT\tvalue");
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toContain("Unknown column");
  });

  it("treats blank optional cells as unspecified updates", () => {
    const result = parseCorporateImportText("obligation_code\tline_code\texpected_amount\tnext_due_date\nADM-001\tRENT\t\t");
    expect(result.errors).toEqual([]);
    expect(result.rows[0].expectedAmount).toBeUndefined();
    expect(result.rows[0].nextDueDate).toBeUndefined();
  });

  it("rejects invalid booleans and malformed dates", () => {
    const booleanResult = parseCorporateImportText("obligation_code\tline_code\trecurring\nADM-001\tRENT\tmaybe");
    expect(booleanResult.errors[0]).toContain("Invalid boolean");
    const dateResult = parseCorporateImportText("obligation_code\tline_code\tnext_due_date\nADM-001\tRENT\t09/01/2026");
    expect(dateResult.errors[0]).toContain("YYYY-MM-DD");
  });

  it("caps imports at 200 rows and requires a preview hash to commit", () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ rowNumber: index + 1, obligationCode: `ADM-${index}`, lineCode: "GENERAL", siteCodes: [] }));
    expect(corporateImportPayloadSchema.safeParse({ rows }).success).toBe(false);
    expect(corporateImportCommitSchema.safeParse({ rows: rows.slice(0, 1), previewHash: "bad" }).success).toBe(false);
    expect(corporateImportCommitSchema.safeParse({ rows: rows.slice(0, 1), previewHash: "a".repeat(64) }).success).toBe(true);
  });
});

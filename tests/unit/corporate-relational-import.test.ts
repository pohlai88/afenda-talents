import { describe, expect, it } from "vitest";

import { parseRelationalImportText, relationalImportPayloadSchema } from "@/lib/corporate-admin/relational-import";

describe("Corporate relational import", () => {
  it("parses deterministic Counterparty Contact identity", () => {
    const result = parseRelationalImportText("CONTACT", "Vendor Code\tContact\tEmail\tPrimary\nCP-1\tOps Manager\tops@example.com\tyes");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ counterpartyCode: "CP-1", contactName: "Ops Manager", email: "ops@example.com", isPrimary: true });
  });

  it("parses Service Coverage endpoints and effective dates", () => {
    const result = parseRelationalImportText("SERVICE_COVERAGE", "site_code\tcounterparty_code\tservice_category\trole_code\teffective_from\teffective_to\nSITE-1\tCP-1\tCLEANING\tPRIMARY_PROVIDER\t2026-01-01\t2026-12-31");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ siteCode: "SITE-1", counterpartyCode: "CP-1", serviceCategory: "CLEANING", roleCode: "PRIMARY_PROVIDER" });
  });

  it("rejects inverted effective dates", () => {
    const result = parseRelationalImportText("OBLIGATION_PARTY", "obligation_code\tcounterparty_code\trole_code\teffective_from\teffective_to\nADM-1\tCP-1\tLANDLORD\t2026-12-31\t2026-01-01");
    expect(result.errors[0]).toContain("Effective-to date");
  });

  it("rejects ambiguous duplicate mapped headers", () => {
    const result = parseRelationalImportText("CONTACT", "counterparty_code\tvendor_code\tcontact_name\temail\nCP-1\tCP-1\tOps\tops@example.com");
    expect(result.errors[0]).toContain("same Afenda field");
  });

  it("requires contact email as the stable imported identity", () => {
    const result = parseRelationalImportText("CONTACT", "counterparty_code\tcontact_name\nCP-1\tOps Manager");
    expect(result.errors[0]).toBeTruthy();
  });

  it("enforces the 200-row transaction ceiling", () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ rowNumber: index + 1, obligationCode: `ADM-${index}`, siteCode: "SITE-1" }));
    expect(relationalImportPayloadSchema.safeParse({ target: "OBLIGATION_SITE", rows }).success).toBe(false);
    expect(relationalImportPayloadSchema.safeParse({ target: "OBLIGATION_SITE", rows: rows.slice(0, 200) }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { MASTER_IMPORT_CLEAR_TOKEN, masterImportPayloadSchema, parseMasterImportText } from "@/lib/corporate-admin/master-import";

describe("Corporate master data import", () => {
  it("parses Site aliases and typed values", () => {
    const result = parseMasterImportText("SITE", "Site\tSite Name\tSite Type\tCountry\tLatitude\tLongitude\tActive\nSITE-HQ\tHQ\tOFFICE\tMY\t3.14\t101.68\tyes");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ code: "SITE-HQ", name: "HQ", type: "OFFICE", countryCode: "MY", latitude: 3.14, longitude: 101.68, isActive: true });
  });

  it("parses Counterparty aliases and payment defaults", () => {
    const result = parseMasterImportText("COUNTERPARTY", "Vendor Code\tVendor Name\tCounterparty Type\tTIN\tCurrency\tPayment Terms\nCP-1\tVendor One\tVENDOR\tT123\tMYR\t30");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ code: "CP-1", name: "Vendor One", type: "VENDOR", taxId: "T123", defaultCurrency: "MYR", paymentTermsDays: 30 });
  });

  it("treats blank master-data fields as unspecified", () => {
    const result = parseMasterImportText("SITE", "site_code\tname\tcity\nSITE-HQ\t\t");
    expect(result.errors).toEqual([]);
    expect(result.rows[0].name).toBeUndefined();
    expect((result.rows[0] as { city?: string }).city).toBeUndefined();
  });

  it("supports explicit clears only on nullable master-data fields", () => {
    const result = parseMasterImportText("COUNTERPARTY", `counterparty_code\tcontact_email\tnotes\nCP-1\t${MASTER_IMPORT_CLEAR_TOKEN}\t${MASTER_IMPORT_CLEAR_TOKEN}`);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].clearFields).toEqual(["contactEmail", "notes"]);
  });

  it("rejects clearing required master-data fields", () => {
    const result = parseMasterImportText("SITE", `site_code\ttype\nSITE-HQ\t${MASTER_IMPORT_CLEAR_TOKEN}`);
    expect(result.errors[0]).toContain("not allowed");
  });

  it("rejects unknown or duplicate mapped master-data columns", () => {
    const unknown = parseMasterImportText("SITE", "site_code\tmystery\nSITE-HQ\tX");
    expect(unknown.errors[0]).toContain("Unknown column");
    const duplicate = parseMasterImportText("COUNTERPARTY", "counterparty_code\tvendor_code\nCP-1\tCP-1");
    expect(duplicate.errors[0]).toContain("same Afenda field");
  });

  it("rejects malformed typed master-data values", () => {
    const result = parseMasterImportText("SITE", "site_code\tlatitude\tis_active\nSITE-HQ\t999\tmaybe");
    expect(result.errors[0]).toMatch(/less than or equal to 90|Invalid boolean/);
  });

  it("enforces the 200-row transaction ceiling", () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ rowNumber: index + 1, code: `SITE-${index}`, clearFields: [] }));
    expect(masterImportPayloadSchema.safeParse({ target: "SITE", rows }).success).toBe(false);
    expect(masterImportPayloadSchema.safeParse({ target: "SITE", rows: rows.slice(0, 200) }).success).toBe(true);
  });
});

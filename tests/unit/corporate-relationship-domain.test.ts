import { describe, expect, it } from "vitest";

import {
  createObligationPartySchema,
  createServiceCoverageSchema,
  createSiteSchema,
  customFieldDefinitionSchema,
  customFieldScopes,
} from "@/lib/corporate-admin/domain";

describe("Corporate relationship graph domain", () => {
  it("accepts a valid site and keeps site taxonomy extensible", () => {
    const parsed = createSiteSchema.safeParse({
      name: "Klang Headquarters",
      type: "REGIONAL_OPERATIONS_HUB",
      organization: "DLBB",
      countryCode: "MY",
      timezone: "Asia/Kuala_Lumpur",
      isActive: true,
      customFields: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts SITE as a governed custom-field scope", () => {
    expect(customFieldScopes).toContain("SITE");
    const parsed = customFieldDefinitionSchema.safeParse({
      scope: "SITE",
      key: "floor_area_sq_m",
      label: "Floor area (sq m)",
      dataType: "NUMBER",
      required: false,
      showInList: true,
      sortOrder: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects service coverage whose end date precedes its start date", () => {
    const parsed = createServiceCoverageSchema.safeParse({
      counterpartyId: "cp_1",
      serviceCategory: "CLEANING",
      effectiveFrom: "2026-08-12",
      effectiveTo: "2026-08-11",
      isPrimary: false,
      isActive: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.some((issue) => issue.path[0] === "effectiveTo")).toBe(true);
  });

  it("accepts open-ended service coverage", () => {
    const parsed = createServiceCoverageSchema.safeParse({
      counterpartyId: "cp_1",
      serviceCategory: "FIRE_SAFETY",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      isPrimary: true,
      isActive: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an obligation-party role with an inverted effective period", () => {
    const parsed = createObligationPartySchema.safeParse({
      counterpartyId: "cp_2",
      roleCode: "BROKER",
      isPrimary: false,
      effectiveFrom: "2026-12-31",
      effectiveTo: "2026-01-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("does not hard-code business relationship roles as an enum", () => {
    const parsed = createObligationPartySchema.safeParse({
      counterpartyId: "cp_3",
      roleCode: "BUILDING_MANAGEMENT_AGENT",
      isPrimary: false,
    });
    expect(parsed.success).toBe(true);
  });
});

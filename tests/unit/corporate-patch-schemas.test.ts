import { describe, expect, it } from "vitest";
import { patchSiteSchema, patchCounterpartyContactSchema, patchServiceCoverageSchema, patchObligationPartySchema, patchObligationSiteSchema } from "@/lib/corporate-admin/update-schemas";

describe("patchSiteSchema", () => {
  it("accepts a deactivation", () => {
    expect(patchSiteSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a field edit", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      name: "Klang Headquarters",
      type: "OFFICE",
      city: "Klang",
      customFields: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(patchSiteSchema.safeParse({ action: "DELETE" }).success).toBe(false);
  });

  it("requires a name on update", () => {
    expect(patchSiteSchema.safeParse({ action: "UPDATE", type: "OFFICE", customFields: {} }).success).toBe(false);
  });

  it("accepts a blank code so it keeps the generated one", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      code: "",
      name: "Klang Headquarters",
      type: "OFFICE",
      customFields: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("strips isActive from an update so activation changes only via SET_ACTIVE", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      name: "Klang Headquarters",
      type: "OFFICE",
      isActive: false,
      customFields: {},
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("isActive" in parsed.data).toBe(false);
  });

  it("leaves customFields undefined when omitted, instead of defaulting to {} and wiping stored values", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      name: "Klang Headquarters",
      type: "OFFICE",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.action === "UPDATE") expect(parsed.data.customFields).toBeUndefined();
  });

  it("still accepts an explicit customFields object on update", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      name: "Klang Headquarters",
      type: "OFFICE",
      customFields: { floor: "12" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.action === "UPDATE") expect(parsed.data.customFields).toEqual({ floor: "12" });
  });
});

describe("patchCounterpartyContactSchema", () => {
  it("accepts a deactivation", () => {
    expect(patchCounterpartyContactSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a field edit", () => {
    expect(patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      email: "siti@example.com",
      isPrimary: true,
    }).success).toBe(true);
  });

  it("accepts a blank email, because the field is optional in the form", () => {
    expect(patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      email: "",
      isPrimary: false,
    }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      email: "not-an-email",
      isPrimary: false,
    }).success).toBe(false);
  });

  it("strips isActive from an update so activation changes only via SET_ACTIVE", () => {
    const parsed = patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      isPrimary: false,
      isActive: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("isActive" in parsed.data).toBe(false);
  });

  it("leaves isPrimary undefined when omitted, instead of defaulting to false and silently demoting", () => {
    const parsed = patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.action === "UPDATE") expect(parsed.data.isPrimary).toBeUndefined();
  });
});

describe("patchServiceCoverageSchema", () => {
  it("accepts a deactivation", () => {
    expect(patchServiceCoverageSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a field edit", () => {
    expect(patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: true,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
    }).success).toBe(true);
  });

  it("rejects an effective-to before effective-from", () => {
    expect(patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: false,
      effectiveFrom: "2026-12-31",
      effectiveTo: "2026-01-01",
    }).success).toBe(false);
  });

  it("does not let the covering counterparty be swapped", () => {
    const parsed = patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: false,
      counterpartyId: "cp_other",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("counterpartyId" in parsed.data).toBe(false);
  });

  it("strips isActive from an update so activation changes only via SET_ACTIVE", () => {
    const parsed = patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: false,
      isActive: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("isActive" in parsed.data).toBe(false);
  });

  it("leaves isPrimary undefined when omitted, instead of defaulting to false and silently demoting", () => {
    const parsed = patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.action === "UPDATE") expect(parsed.data.isPrimary).toBeUndefined();
  });
});

describe("patchObligationPartySchema", () => {
  const key = { counterpartyId: "cp_1", roleCode: "LANDLORD" };

  it("accepts a deactivation carrying the composite key", () => {
    expect(patchObligationPartySchema.safeParse({ action: "SET_ACTIVE", ...key, isActive: false }).success).toBe(true);
  });

  it("rejects a deactivation with no key to identify the row", () => {
    expect(patchObligationPartySchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(false);
  });

  it("accepts an edit of the non-key fields", () => {
    expect(patchObligationPartySchema.safeParse({ action: "UPDATE", ...key, isPrimary: true }).success).toBe(true);
  });

  it("rejects an effective-to before effective-from", () => {
    expect(patchObligationPartySchema.safeParse({
      action: "UPDATE",
      ...key,
      isPrimary: false,
      effectiveFrom: "2026-06-01",
      effectiveTo: "2026-01-01",
    }).success).toBe(false);
  });

  it("leaves isPrimary undefined when omitted, instead of defaulting to false and silently demoting", () => {
    const parsed = patchObligationPartySchema.safeParse({ action: "UPDATE", ...key });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.action === "UPDATE") expect(parsed.data.isPrimary).toBeUndefined();
  });
});

describe("patchObligationSiteSchema", () => {
  it("accepts a deactivation, which is the only way to undo a wrong link", () => {
    expect(patchObligationSiteSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a scope correction", () => {
    expect(patchObligationSiteSchema.safeParse({ action: "UPDATE", scopeRole: "PRIMARY_PREMISES" }).success).toBe(true);
  });

  it("accepts an empty update, because both fields are optional", () => {
    expect(patchObligationSiteSchema.safeParse({ action: "UPDATE" }).success).toBe(true);
  });

  it("does not let the linked site be swapped", () => {
    const parsed = patchObligationSiteSchema.safeParse({ action: "UPDATE", siteId: "site_other" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("siteId" in parsed.data).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { patchSiteSchema, patchCounterpartyContactSchema, patchServiceCoverageSchema } from "@/lib/corporate-admin/update-schemas";

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
});

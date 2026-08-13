import { describe, expect, it } from "vitest";
import { patchSiteSchema } from "@/lib/corporate-admin/update-schemas";

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
    expect(parsed.success && "isActive" in parsed.data).toBe(false);
  });
});

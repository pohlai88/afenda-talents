import { describe, expect, it } from "vitest";

import { corporateBulkOperationSchema } from "@/lib/corporate-admin/operations-bulk";

describe("Corporate spreadsheet operations", () => {
  it("accepts bounded line activation batches", () => {
    const parsed = corporateBulkOperationSchema.safeParse({ action: "SET_LINE_ACTIVE", lineIds: ["line-a", "line-b"], isActive: false });
    expect(parsed.success).toBe(true);
  });

  it("deduplicates repeated selected identifiers", () => {
    const parsed = corporateBulkOperationSchema.parse({ action: "SET_LINE_ACTIVE", lineIds: ["line-a", "line-a", "line-b"], isActive: true });
    expect(parsed.lineIds).toEqual(["line-a", "line-b"]);
  });

  it("rejects empty bulk selections", () => {
    expect(corporateBulkOperationSchema.safeParse({ action: "SET_LINE_ACTIVE", lineIds: [], isActive: true }).success).toBe(false);
  });

  it("accepts bulk Site linking with an optional relationship role", () => {
    const parsed = corporateBulkOperationSchema.safeParse({ action: "LINK_SITE", obligationIds: ["obl-a", "obl-b"], siteId: "site-a", scopeRole: "PREMISES" });
    expect(parsed.success).toBe(true);
  });

  it("caps mutation batches to avoid unbounded spreadsheet writes", () => {
    const ids = Array.from({ length: 201 }, (_, index) => `line-${index}`);
    expect(corporateBulkOperationSchema.safeParse({ action: "SET_LINE_ACTIVE", lineIds: ids, isActive: true }).success).toBe(false);
  });
});

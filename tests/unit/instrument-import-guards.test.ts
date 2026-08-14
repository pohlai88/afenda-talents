import { describe, expect, it } from "vitest";
import { ImportTargetError, assertImportableTarget } from "@/lib/instrument-import";

describe("assertImportableTarget", () => {
  it("accepts an organisation assessment", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "ORGANISATION", status: "DRAFT" }),
    ).not.toThrow();
  });

  it("accepts a template assessment", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "TEMPLATE", status: "PUBLISHED" }),
    ).not.toThrow();
  });

  it("refuses a SYSTEM kind", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "SYSTEM", status: "PUBLISHED" }),
    ).toThrow(ImportTargetError);
  });

  it("refuses an isSystem row even if the kind disagrees", () => {
    expect(() =>
      assertImportableTarget({ isSystem: true, kind: "ORGANISATION", status: "PUBLISHED" }),
    ).toThrow(ImportTargetError);
  });

  it("refuses an archived assessment", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "ORGANISATION", status: "ARCHIVED" }),
    ).toThrow(ImportTargetError);
  });

  it("reports 409 so the route does not have to map it", () => {
    try {
      assertImportableTarget({ isSystem: true, kind: "SYSTEM", status: "PUBLISHED" });
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ImportTargetError);
      expect((error as ImportTargetError).status).toBe(409);
    }
  });

  it("says why, naming the instrument as seed-owned", () => {
    try {
      assertImportableTarget({ isSystem: true, kind: "SYSTEM", status: "PUBLISHED" });
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as Error).message).toMatch(/seed-owned/i);
    }
  });
});

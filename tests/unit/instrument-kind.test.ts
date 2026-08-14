import { describe, expect, it } from "vitest";
import {
  allocateAssessmentKey,
  isReservedAssessmentKey,
  kindFlags,
  normalizeAssessmentKey,
} from "@/lib/instrument-kind";

describe("normalizeAssessmentKey", () => {
  it("trims, NFKC-normalises and lowercases", () => {
    expect(normalizeAssessmentKey("  Afenda-Core  ")).toBe("afenda-core");
  });
});

describe("isReservedAssessmentKey", () => {
  it("reserves the afenda- prefix after normalisation", () => {
    expect(isReservedAssessmentKey("  AFENDA-anything ")).toBe(true);
  });

  it("allows other prefixes", () => {
    expect(isReservedAssessmentKey("org-1a2b3c")).toBe(false);
  });
});

describe("kindFlags", () => {
  it("derives isSystem from kind so the two cannot disagree", () => {
    expect(kindFlags("SYSTEM")).toEqual({ kind: "SYSTEM", isSystem: true });
    expect(kindFlags("TEMPLATE")).toEqual({ kind: "TEMPLATE", isSystem: false });
    expect(kindFlags("ORGANISATION")).toEqual({ kind: "ORGANISATION", isSystem: false });
  });
});

describe("allocateAssessmentKey", () => {
  it("prefixes by kind", () => {
    expect(allocateAssessmentKey("ORGANISATION")).toMatch(/^org-[0-9a-f]{12}$/);
    expect(allocateAssessmentKey("TEMPLATE")).toMatch(/^tpl-[0-9a-f]{12}$/);
  });

  it("never collides across many allocations", () => {
    const keys = new Set(
      Array.from({ length: 500 }, () => allocateAssessmentKey("ORGANISATION")),
    );
    expect(keys.size).toBe(500);
  });

  it("never allocates a reserved key", () => {
    expect(isReservedAssessmentKey(allocateAssessmentKey("ORGANISATION"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  cleanOptionalString,
  createCounterpartySchema,
  createObligationSchema,
  createSiteSchema,
} from "@/lib/corporate-admin/domain";

/**
 * Every create form labels its reference code "Auto-generated if blank" and POSTs its
 * draft verbatim, so a blank field arrives as "" — not undefined. The routes already
 * cope, because cleanOptionalString("") is null and the `?? newReferenceCode(...)`
 * fallback fires. The schemas must therefore accept "" rather than rejecting it as
 * too short, otherwise the documented auto-generation path is unreachable.
 *
 * A one-character code is still a mistake and must stay rejected.
 */
const site = { name: "Klang Headquarters", type: "OFFICE" };
const counterparty = { name: "Acme Sdn Bhd", type: "VENDOR" };
const obligation = {
  organization: "DLBB",
  category: "LEASE",
  title: "Klang warehouse lease",
  counterpartyId: "cp_1",
  startDate: "2026-01-01",
  currency: "MYR",
};

describe("Blank reference code reaches the route's auto-generator", () => {
  it("accepts a blank site code", () => {
    expect(createSiteSchema.safeParse({ ...site, code: "" }).success).toBe(true);
  });

  it("accepts a blank counterparty code", () => {
    expect(createCounterpartySchema.safeParse({ ...counterparty, code: "" }).success).toBe(true);
  });

  it("accepts a blank obligation code", () => {
    expect(createObligationSchema.safeParse({ ...obligation, code: "" }).success).toBe(true);
  });

  it("still accepts an omitted code", () => {
    expect(createSiteSchema.safeParse(site).success).toBe(true);
    expect(createCounterpartySchema.safeParse(counterparty).success).toBe(true);
    expect(createObligationSchema.safeParse(obligation).success).toBe(true);
  });

  it("still rejects a one-character code as a typo", () => {
    expect(createSiteSchema.safeParse({ ...site, code: "A" }).success).toBe(false);
    expect(createCounterpartySchema.safeParse({ ...counterparty, code: "A" }).success).toBe(false);
    expect(createObligationSchema.safeParse({ ...obligation, code: "A" }).success).toBe(false);
  });

  it("preserves a code the user actually supplied", () => {
    const parsed = createSiteSchema.safeParse({ ...site, code: "SITE-KL-01" });
    expect(parsed.success && parsed.data.code).toBe("SITE-KL-01");
  });

  it("normalises a blank code to null so the route falls back", () => {
    expect(cleanOptionalString("")).toBeNull();
    expect(cleanOptionalString("   ")).toBeNull();
    expect(cleanOptionalString(" AB ")).toBe("AB");
  });
});

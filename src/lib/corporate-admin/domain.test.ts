import { describe, expect, it } from "vitest";
import {
  assertObligationTransition,
  cleanOptionalString,
  createCounterpartySchema,
  createSiteSchema,
  defaultPeriodLabel,
  deriveDueState,
  nextOccurrence,
} from "@/lib/corporate-admin/domain";

describe("corporate administration domain", () => {
  it("preserves month-end recurrence", () => {
    expect(nextOccurrence("2027-01-31", 1, "MONTH")).toBe("2027-02-28");
    expect(nextOccurrence("2028-01-31", 1, "MONTH")).toBe("2028-02-29");
    expect(nextOccurrence("2028-02-29", 1, "MONTH")).toBe("2028-03-31");
  });

  it("supports quarterly and annual recurrence without special enum values", () => {
    expect(nextOccurrence("2026-08-15", 3, "MONTH")).toBe("2026-11-15");
    expect(nextOccurrence("2028-02-29", 1, "YEAR")).toBe("2029-02-28");
  });

  it("derives time-sensitive due state instead of persisting it", () => {
    expect(deriveDueState("OPEN", "2026-08-11", "2026-08-12")).toBe("OVERDUE");
    expect(deriveDueState("OPEN", "2026-08-12", "2026-08-12")).toBe("DUE");
    expect(deriveDueState("OPEN", "2026-08-13", "2026-08-12")).toBe("UPCOMING");
    expect(deriveDueState("COMPLETED", "2026-08-01", "2026-08-12")).toBe("COMPLETED");
  });

  it("enforces the deliberately small obligation lifecycle", () => {
    expect(() => assertObligationTransition("DRAFT", "ACTIVE")).not.toThrow();
    expect(() => assertObligationTransition("ACTIVE", "ENDED")).not.toThrow();
    expect(() => assertObligationTransition("ENDED", "ACTIVE")).toThrow(/Invalid obligation transition/);
  });

  it("uses a stable monthly period label", () => {
    expect(defaultPeriodLabel("2026-08-31")).toBe("2026-08");
  });

  it("accepts a blank countryCode like its sibling defaultCurrency, instead of 400ing a blank form field", () => {
    const counterparty = createCounterpartySchema.safeParse({
      name: "Acme Sdn Bhd",
      type: "VENDOR",
      countryCode: "",
    });
    expect(counterparty.success).toBe(true);
    if (counterparty.success) expect(counterparty.data.countryCode).toBe("");

    const site = createSiteSchema.safeParse({
      name: "Klang Warehouse",
      type: "WAREHOUSE",
      countryCode: "",
    });
    expect(site.success).toBe(true);
    if (site.success) expect(site.data.countryCode).toBe("");
  });

  it("still rejects a malformed (non-blank) countryCode", () => {
    const result = createCounterpartySchema.safeParse({ name: "Acme Sdn Bhd", type: "VENDOR", countryCode: "MYS" });
    expect(result.success).toBe(false);
  });

  it("clears a blank countryCode to null the same way the sites route stores it", () => {
    // Sites route: countryCode: cleanOptionalString(parsed.data.countryCode)?.toUpperCase() ?? null
    expect(cleanOptionalString("")?.toUpperCase() ?? null).toBeNull();
  });
});

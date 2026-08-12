import { describe, expect, it } from "vitest";

import {
  createDueItemWithLineSchema,
  createObligationLineSchema,
  OBLIGATION_LINE_TYPE_SUGGESTIONS,
  patchObligationLineSchema,
} from "@/lib/corporate-admin/obligation-lines";

describe("Corporate obligation lines", () => {
  it("supports independent recurring schedules", () => {
    const parsed = createObligationLineSchema.safeParse({
      code: "RENT", name: "Monthly rent", lineType: "RENT", expectedAmount: 15000, currency: "MYR",
      recurring: true, recurrenceInterval: 1, recurrenceUnit: "MONTH", firstDueDate: "2026-09-01", nextDueDate: "2026-09-01",
      invoiceRequired: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a due anchor for recurring lines", () => {
    const parsed = createObligationLineSchema.safeParse({
      code: "SERVICE", name: "Service charge", lineType: "SERVICE_CHARGE", currency: "MYR",
      recurring: true, recurrenceInterval: 1, recurrenceUnit: "MONTH", invoiceRequired: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps business line taxonomy extensible", () => {
    expect(OBLIGATION_LINE_TYPE_SUGGESTIONS).toContain("RENT");
    const parsed = createObligationLineSchema.safeParse({
      code: "GREEN_FEE", name: "Green operating fee", lineType: "SUSTAINABILITY_SURCHARGE", currency: "MYR", recurring: false, invoiceRequired: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts explicit line selection for due creation", () => {
    const parsed = createDueItemWithLineSchema.safeParse({ mode: "NEXT", lineId: "line_123", customFields: {} });
    expect(parsed.success).toBe(true);
  });

  it("supports manual due creation against an explicit line", () => {
    const parsed = createDueItemWithLineSchema.safeParse({
      mode: "MANUAL",
      lineId: "line_rent",
      dueDate: "2026-08-31",
      periodLabel: "Exceptional rent adjustment",
      expectedAmount: 900,
      currency: "MYR",
      customFields: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("allows full controlled line schedule edits", () => {
    const parsed = patchObligationLineSchema.safeParse({
      action: "UPDATE",
      name: "Parking bays",
      lineType: "PARKING",
      expectedAmount: 500,
      currency: "MYR",
      recurring: true,
      recurrenceInterval: 1,
      recurrenceUnit: "MONTH",
      firstDueDate: "2026-08-01",
      nextDueDate: "2026-09-01",
      invoiceRequired: false,
      paymentTermsDays: 7,
      startDate: "2026-08-01",
      endDate: "2027-07-31",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects recurring schedule edits without a due anchor", () => {
    const parsed = patchObligationLineSchema.safeParse({
      action: "UPDATE",
      recurring: true,
      recurrenceInterval: 1,
      recurrenceUnit: "MONTH",
      firstDueDate: null,
      nextDueDate: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("allows controlled line activation changes", () => {
    expect(patchObligationLineSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { deriveOperationsReviewSignals } from "@/lib/corporate-admin/operations-intelligence";

describe("Corporate operations intelligence", () => {
  it("flags active sites without coverage for review", () => {
    const signals = deriveOperationsReviewSignals([{ id: "site-1", name: "Klang HQ", activeCoverageCount: 0 }], []);
    expect(signals).toEqual([expect.objectContaining({ severity: "REVIEW", href: "/admin/corporate/sites/site-1" })]);
  });

  it("flags recurring active lines without a next due date", () => {
    const signals = deriveOperationsReviewSignals([], [{ id: "line-1", obligationId: "ob-1", obligationTitle: "HQ tenancy", code: "RENT", name: "Monthly rent", active: true, obligationActive: true, recurring: true, nextDueDate: null, overdueDueCount: 0 }]);
    expect(signals[0]).toEqual(expect.objectContaining({ severity: "ACTION", href: "/admin/corporate/obligations/ob-1/lines" }));
  });

  it("flags overdue due items against their agreement line", () => {
    const signals = deriveOperationsReviewSignals([], [{ id: "line-1", obligationId: "ob-1", obligationTitle: "HQ tenancy", code: "RENT", name: "Monthly rent", active: true, obligationActive: true, recurring: true, nextDueDate: "2026-09-01", overdueDueCount: 2 }]);
    expect(signals).toEqual([expect.objectContaining({ severity: "ACTION", title: expect.stringContaining("2 overdue") })]);
  });

  it("does not raise schedule or overdue signals for inactive lines or ended agreements", () => {
    const signals = deriveOperationsReviewSignals([], [
      { id: "line-1", obligationId: "ob-1", obligationTitle: "Old tenancy", code: "RENT", name: "Rent", active: false, obligationActive: true, recurring: true, nextDueDate: null, overdueDueCount: 3 },
      { id: "line-2", obligationId: "ob-2", obligationTitle: "Ended tenancy", code: "RENT", name: "Rent", active: true, obligationActive: false, recurring: true, nextDueDate: null, overdueDueCount: 3 },
    ]);
    expect(signals).toEqual([]);
  });

  it("sorts action signals before review signals", () => {
    const signals = deriveOperationsReviewSignals(
      [{ id: "site-1", name: "Klang HQ", activeCoverageCount: 0 }],
      [{ id: "line-1", obligationId: "ob-1", obligationTitle: "HQ tenancy", code: "RENT", name: "Rent", active: true, obligationActive: true, recurring: true, nextDueDate: null, overdueDueCount: 0 }],
    );
    expect(signals.map((signal) => signal.severity)).toEqual(["ACTION", "REVIEW"]);
  });
});

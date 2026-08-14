import { describe, expect, it } from "vitest";

import {
  closureBlockers,
  closureUpsertSchema,
  historicalPaymentRowSchema,
  reconciliationDifference,
  reconciliationItemSchema,
} from "@/lib/corporate-admin/settlement";

describe("Corporate settlement and closure", () => {
  it("accepts termination evidence and dates", () => {
    const parsed = closureUpsertSchema.safeParse({
      terminationType: "TERMINATED",
      noticeDate: "2026-07-15",
      effectiveDate: "2026-08-31",
      handoverDate: "2026-09-01",
      terminationReason: "Mutual termination after final settlement.",
      terminationDocumentUrl: "https://example.com/termination.pdf",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects notice after the effective termination date", () => {
    const parsed = closureUpsertSchema.safeParse({
      terminationType: "TERMINATED",
      noticeDate: "2026-09-01",
      effectiveDate: "2026-08-31",
      terminationReason: "Termination",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects impossible calendar dates instead of normalising them", () => {
    expect(closureUpsertSchema.safeParse({
      terminationType: "TERMINATED",
      effectiveDate: "2026-02-31",
      terminationReason: "Termination",
    }).success).toBe(false);
    expect(historicalPaymentRowSchema.safeParse({
      obligationCode: "TEN-001",
      lineCode: "RENT",
      dueDate: "2026-02-31",
      paidAmount: 500,
      paymentDate: "2026-02-31",
      paymentMethod: "BANK_TRANSFER",
    }).success).toBe(false);
  });

  it("supports deposit refunds and final cleaning charges", () => {
    expect(reconciliationItemSchema.safeParse({
      category: "DEPOSIT",
      direction: "RECEIVABLE",
      description: "Security deposit refund",
      expectedAmount: 20000,
      currency: "MYR",
      status: "OPEN",
    }).success).toBe(true);
    expect(reconciliationItemSchema.safeParse({
      category: "CLEANING",
      direction: "PAYABLE",
      description: "Final reinstatement cleaning",
      actualAmount: 850,
      currency: "MYR",
      status: "SETTLED",
    }).success).toBe(true);
  });

  it("accepts historical payments by business keys without internal ids", () => {
    const parsed = historicalPaymentRowSchema.safeParse({
      obligationCode: "TEN-001",
      lineCode: "RENT",
      dueDate: "2026-07-01",
      paidAmount: 17235.6,
      paymentDate: "2026-07-03",
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "TXN-001",
      reconciled: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects historical rows that cannot resolve a due item", () => {
    const parsed = historicalPaymentRowSchema.safeParse({
      paidAmount: 500,
      paymentDate: "2026-07-03",
      paymentMethod: "BANK_TRANSFER",
    });
    expect(parsed.success).toBe(false);
  });

  it("blocks closure while operational balances remain unresolved", () => {
    expect(closureBlockers({
      effectiveDate: "2026-08-13",
      today: "2026-08-13",
      openDueItems: 1,
      pendingApprovals: 1,
      unreconciledPayments: 2,
      unresolvedReconciliationItems: 1,
      alreadyClosed: false,
    })).toEqual([
      "1 due item(s) remain open",
      "1 payment request(s) remain pending or approved but unpaid",
      "2 recorded payment(s) remain unreconciled",
      "1 reconciliation item(s) remain unresolved",
    ]);
  });

  it("blocks closure before a future termination is effective", () => {
    expect(closureBlockers({
      effectiveDate: "2026-08-31",
      today: "2026-08-13",
      openDueItems: 0,
      pendingApprovals: 0,
      unreconciledPayments: 0,
      unresolvedReconciliationItems: 0,
      alreadyClosed: false,
    })).toContain("Termination is not effective until 2026-08-31");
  });

  it("allows closure only when every gate is clear", () => {
    expect(closureBlockers({
      effectiveDate: "2026-08-13",
      today: "2026-08-13",
      openDueItems: 0,
      pendingApprovals: 0,
      unreconciledPayments: 0,
      unresolvedReconciliationItems: 0,
      alreadyClosed: false,
    })).toEqual([]);
  });

  it("calculates final reconciliation variances in cents", () => {
    expect(reconciliationDifference(1000, 950.125)).toBe(-49.88);
    expect(reconciliationDifference(null, 950)).toBeNull();
  });
});

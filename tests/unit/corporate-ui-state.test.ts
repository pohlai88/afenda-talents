import { describe, expect, it } from "vitest";

import { obligationCanActivate, obligationNextAction, obligationReadiness, type ObligationUiInput } from "@/lib/corporate-admin/ui-state";

function base(overrides: Partial<ObligationUiInput> = {}): ObligationUiInput {
  return {
    status: "DRAFT",
    counterpartyActive: true,
    startDate: "2026-08-01",
    currency: "MYR",
    ownerAssigned: true,
    recurring: true,
    recurrenceInterval: 1,
    recurrenceUnit: "MONTH",
    nextDueDate: "2026-09-01",
    contractRequired: true,
    contractFileUrl: "https://example.com/contract",
    requiredCustomFields: [],
    customFields: {},
    overdueDueItems: 0,
    pendingApprovals: 0,
    unreconciledPayments: 0,
    ...overrides,
  };
}

describe("Corporate obligation UI state", () => {
  it("matches activation blockers enforced by the API", () => {
    expect(obligationCanActivate(base())).toBe(true);
    expect(obligationCanActivate(base({ contractFileUrl: null }))).toBe(false);
    expect(obligationCanActivate(base({ recurrenceInterval: null }))).toBe(false);
    expect(obligationCanActivate(base({ nextDueDate: null }))).toBe(false);
  });

  it("treats non-required contract evidence as optional rather than incomplete", () => {
    const items = obligationReadiness(base({ contractRequired: false, contractFileUrl: null }));
    expect(items.find((item) => item.label === "Contract evidence")?.state).toBe("optional");
    expect(obligationCanActivate(base({ contractRequired: false, contractFileUrl: null }))).toBe(true);
  });

  it("surfaces required custom fields as activation readiness", () => {
    const input = base({
      requiredCustomFields: [{ key: "policy_number", label: "Policy number" }],
      customFields: {},
    });
    expect(obligationCanActivate(input)).toBe(false);
    expect(obligationReadiness(input).find((item) => item.label === "Required custom fields")?.detail).toContain("Policy number");
  });

  it("prioritizes overdue items over normal recurring generation", () => {
    const next = obligationNextAction(base({ status: "ACTIVE", overdueDueItems: 2 }));
    expect(next.action).toContain("2 overdue due items");
    expect(next.tone).toBe("attention");
  });

  it("moves through approval, reconciliation and recurrence priorities", () => {
    expect(obligationNextAction(base({ status: "ACTIVE", pendingApprovals: 1 })).action).toContain("pending payment approval");
    expect(obligationNextAction(base({ status: "ACTIVE", unreconciledPayments: 1 })).action).toContain("Reconcile 1 recorded payment");
    expect(obligationNextAction(base({ status: "ACTIVE" })).action).toContain("2026-09-01");
  });
});

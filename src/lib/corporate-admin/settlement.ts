import { z } from "zod";

export const reconciliationCategories = [
  "DEPOSIT",
  "RENTAL",
  "CLEANING",
  "UTILITIES",
  "REPAIR_MAINTENANCE",
  "SERVICE_CHARGE",
  "PENALTY_INTEREST",
  "CREDIT_REFUND",
  "OTHER",
] as const;

export const reconciliationDirections = ["PAYABLE", "RECEIVABLE"] as const;
export const reconciliationStatuses = ["OPEN", "SETTLED", "WAIVED", "DISPUTED"] as const;
export const terminationTypes = ["EXPIRED", "TERMINATED", "CANCELLED", "SURRENDERED", "OTHER"] as const;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalText = z.string().trim().max(10_000).optional().nullable();
const optionalUrl = z.string().trim().url().max(2_000).optional().nullable().or(z.literal(""));
const money = z.number().min(0).max(999_999_999_999_999.99).optional().nullable();
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");

export const closureUpsertSchema = z.object({
  terminationType: z.enum(terminationTypes),
  noticeDate: dateOnly.optional().nullable(),
  effectiveDate: dateOnly,
  handoverDate: dateOnly.optional().nullable(),
  terminationReason: z.string().trim().min(1).max(10_000),
  terminationDocumentUrl: optionalUrl,
  notes: optionalText,
}).superRefine((value, ctx) => {
  if (value.noticeDate && value.noticeDate > value.effectiveDate) {
    ctx.addIssue({ code: "custom", path: ["noticeDate"], message: "Notice date cannot be after the effective termination date" });
  }
  if (value.handoverDate && value.handoverDate < value.effectiveDate) {
    ctx.addIssue({ code: "custom", path: ["handoverDate"], message: "Handover date cannot be before the effective termination date" });
  }
});

export const reconciliationItemSchema = z.object({
  category: z.enum(reconciliationCategories),
  direction: z.enum(reconciliationDirections),
  description: z.string().trim().min(1).max(500),
  expectedAmount: money,
  actualAmount: money,
  currency,
  status: z.enum(reconciliationStatuses).default("OPEN"),
  evidenceUrl: optionalUrl,
  dueItemId: z.string().trim().min(1).optional().nullable(),
  paymentId: z.string().trim().min(1).optional().nullable(),
  notes: optionalText,
});

export const reconciliationItemPatchSchema = z.object({
  actualAmount: money,
  status: z.enum(reconciliationStatuses),
  evidenceUrl: optionalUrl,
  notes: optionalText,
});

export const closeFileSchema = z.object({ action: z.literal("CLOSE_FILE") });

export type ClosureGateInput = {
  effectiveDate: string | null;
  openDueItems: number;
  pendingApprovals: number;
  unreconciledPayments: number;
  unresolvedReconciliationItems: number;
  alreadyClosed: boolean;
};

export function closureBlockers(input: ClosureGateInput): string[] {
  const blockers: string[] = [];
  if (!input.effectiveDate) blockers.push("Termination effective date is required");
  if (input.openDueItems > 0) blockers.push(`${input.openDueItems} due item(s) remain open`);
  if (input.pendingApprovals > 0) blockers.push(`${input.pendingApprovals} payment approval(s) remain pending`);
  if (input.unreconciledPayments > 0) blockers.push(`${input.unreconciledPayments} recorded payment(s) remain unreconciled`);
  if (input.unresolvedReconciliationItems > 0) blockers.push(`${input.unresolvedReconciliationItems} reconciliation item(s) remain unresolved`);
  if (input.alreadyClosed) blockers.push("File is already closed");
  return blockers;
}

export function reconciliationDifference(expected: number | null, actual: number | null): number | null {
  if (expected == null || actual == null) return null;
  return Math.round((actual - expected) * 100) / 100;
}

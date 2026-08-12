import { z } from "zod";

import { createDueItemSchema, recurrenceUnits } from "@/lib/corporate-admin/domain";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date");

export const OBLIGATION_LINE_TYPE_SUGGESTIONS = [
  "GENERAL",
  "RENT",
  "SERVICE_CHARGE",
  "PARKING",
  "DEPOSIT",
  "MAINTENANCE",
  "INSURANCE_PREMIUM",
  "UTILITY",
  "LICENCE_FEE",
  "SUBSCRIPTION",
  "OTHER",
] as const;

const lineShape = {
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens or underscores"),
  name: z.string().trim().min(1).max(160),
  lineType: z.string().trim().min(1).max(80),
  expectedAmount: z.number().min(0).max(999_999_999_999_999.99).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  recurring: z.boolean().default(false),
  recurrenceInterval: z.number().int().min(1).max(120).optional().nullable(),
  recurrenceUnit: z.enum(recurrenceUnits).optional().nullable(),
  firstDueDate: dateOnly.optional().nullable(),
  nextDueDate: dateOnly.optional().nullable(),
  invoiceRequired: z.boolean().default(false),
  paymentTermsDays: z.number().int().min(0).max(3650).optional().nullable(),
  startDate: dateOnly.optional().nullable(),
  endDate: dateOnly.optional().nullable(),
  notes: z.string().trim().max(10_000).optional().nullable(),
};

function validateLineSchedule(
  value: {
    recurring?: boolean;
    recurrenceInterval?: number | null;
    recurrenceUnit?: (typeof recurrenceUnits)[number] | null;
    firstDueDate?: string | null;
    nextDueDate?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.endDate && value.startDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date" });
  }
  if (value.recurring && (!value.recurrenceInterval || !value.recurrenceUnit)) {
    ctx.addIssue({ code: "custom", path: ["recurrenceInterval"], message: "Recurring lines need an interval and unit" });
  }
  if (value.recurring === false && (value.recurrenceInterval || value.recurrenceUnit)) {
    ctx.addIssue({ code: "custom", path: ["recurring"], message: "Recurrence settings require recurring to be enabled" });
  }
  if (value.recurring && !value.nextDueDate && !value.firstDueDate) {
    ctx.addIssue({ code: "custom", path: ["firstDueDate"], message: "Recurring lines need a first or next due date" });
  }
}

export const createObligationLineSchema = z.object(lineShape).superRefine(validateLineSchedule);

export const patchObligationLineSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_ACTIVE"), isActive: z.boolean() }),
  z.object({
    action: z.literal("UPDATE"),
    name: lineShape.name.optional(),
    lineType: lineShape.lineType.optional(),
    expectedAmount: lineShape.expectedAmount,
    currency: lineShape.currency.optional(),
    recurring: z.boolean().optional(),
    recurrenceInterval: lineShape.recurrenceInterval,
    recurrenceUnit: lineShape.recurrenceUnit,
    firstDueDate: lineShape.firstDueDate,
    nextDueDate: lineShape.nextDueDate,
    invoiceRequired: z.boolean().optional(),
    paymentTermsDays: lineShape.paymentTermsDays,
    startDate: lineShape.startDate,
    endDate: lineShape.endDate,
    notes: lineShape.notes,
  }).superRefine(validateLineSchedule),
]);

export const createDueItemWithLineSchema = createDueItemSchema.extend({ lineId: z.string().trim().min(1).optional() });

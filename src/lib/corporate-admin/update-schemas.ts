import { z } from "zod";
import { createCounterpartySchema, createCounterpartyContactSchema, createObligationSchema, createSiteSchema } from "@/lib/corporate-admin/domain";

export const updateCounterpartySchema = createCounterpartySchema;
export const updateObligationSchema = createObligationSchema;

export const updateDueItemSchema = z.object({
  periodLabel: z.string().trim().min(1).max(80),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  expectedAmount: z.number().min(0).max(999_999_999_999_999.99).optional().nullable(),
  invoiceAmount: z.number().min(0).max(999_999_999_999_999.99).optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  invoiceRequired: z.boolean(),
  invoiceNumber: z.string().trim().max(500).optional().nullable(),
  invoiceFileUrl: z.string().trim().url().max(2_000).optional().nullable().or(z.literal("")),
  disputeFlag: z.boolean(),
  notes: z.string().trim().max(10_000).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

const setActive = z.object({ action: z.literal("SET_ACTIVE"), isActive: z.boolean() });

export const patchSiteSchema = z.discriminatedUnion("action", [
  setActive,
  createSiteSchema.omit({ isActive: true }).extend({
    action: z.literal("UPDATE"),
    // createSiteSchema still rejects "" for code on this branch; a blank code here
    // means "keep the generated one", so it must parse.
    code: z.string().trim().min(2).max(50).optional().nullable().or(z.literal("")),
  }),
]);

export const patchCounterpartyContactSchema = z.discriminatedUnion("action", [
  setActive,
  createCounterpartyContactSchema.omit({ isActive: true }).extend({ action: z.literal("UPDATE") }),
]);

const coverageDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date");

export const patchServiceCoverageSchema = z.discriminatedUnion("action", [
  setActive,
  z
    .object({
      action: z.literal("UPDATE"),
      serviceCategory: z.string().trim().min(1).max(120),
      roleCode: z.string().trim().max(120).optional().nullable(),
      effectiveFrom: coverageDateOnly.optional().nullable(),
      effectiveTo: coverageDateOnly.optional().nullable(),
      isPrimary: z.boolean().default(false),
      serviceLevel: z.string().trim().max(500).optional().nullable(),
      emergencyContact: z.string().trim().max(500).optional().nullable(),
      notes: z.string().trim().max(10_000).optional().nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
        ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective-to date cannot be before effective-from date" });
      }
    }),
]);

const partyKey = {
  counterpartyId: z.string().trim().min(1),
  roleCode: z.string().trim().min(1).max(120),
};

export const patchObligationPartySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_ACTIVE"), ...partyKey, isActive: z.boolean() }),
  z
    .object({
      action: z.literal("UPDATE"),
      ...partyKey,
      isPrimary: z.boolean().default(false),
      effectiveFrom: coverageDateOnly.optional().nullable(),
      effectiveTo: coverageDateOnly.optional().nullable(),
      notes: z.string().trim().max(10_000).optional().nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
        ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective-to date cannot be before effective-from date" });
      }
    }),
]);

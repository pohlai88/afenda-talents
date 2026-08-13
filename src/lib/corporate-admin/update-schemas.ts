import { z } from "zod";
import { createCounterpartySchema, createObligationSchema } from "@/lib/corporate-admin/domain";

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
  z.object({
    action: z.literal("UPDATE"),
    code: z.string().trim().min(2).max(50).optional().nullable().or(z.literal("")),
    name: z.string().trim().min(1).max(240),
    type: z.string().trim().min(1).max(100),
    organization: z.string().trim().max(160).optional().nullable(),
    addressLine1: z.string().trim().max(500).optional().nullable(),
    addressLine2: z.string().trim().max(500).optional().nullable(),
    city: z.string().trim().max(160).optional().nullable(),
    stateRegion: z.string().trim().max(160).optional().nullable(),
    postalCode: z.string().trim().max(40).optional().nullable(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code").optional().nullable().or(z.literal("")),
    timezone: z.string().trim().max(100).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    notes: z.string().trim().max(10_000).optional().nullable(),
    customFields: z.record(z.string(), z.unknown()).default({}),
  }),
]);

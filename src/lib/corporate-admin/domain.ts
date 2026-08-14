import { z } from "zod";

export const COUNTERPARTY_TYPE_SUGGESTIONS = [
  "VENDOR",
  "LANDLORD",
  "SERVICE_PROVIDER",
  "INSURER",
  "FINANCIER",
  "GOVERNMENT_AGENCY",
  "UTILITY_PROVIDER",
  "PROFESSIONAL_FIRM",
  "LICENSOR",
  "OTHER",
] as const;

export const SITE_TYPE_SUGGESTIONS = [
  "OFFICE",
  "WAREHOUSE",
  "FARM",
  "CENTRAL_KITCHEN",
  "RETAIL_STORE",
  "FNB_OUTLET",
  "FACTORY",
  "PROJECT_SITE",
  "LAND",
  "OTHER",
] as const;

export const SERVICE_CATEGORY_SUGGESTIONS = [
  "LANDLORD",
  "CLEANING",
  "SECURITY",
  "PEST_CONTROL",
  "LIFT_MAINTENANCE",
  "FIRE_SAFETY",
  "AIR_CONDITIONING",
  "ELECTRICITY",
  "WATER",
  "INTERNET",
  "INSURANCE",
  "WASTE_MANAGEMENT",
  "FACILITY_MAINTENANCE",
  "PROFESSIONAL_SERVICE",
  "OTHER",
] as const;

export const OBLIGATION_PARTY_ROLE_SUGGESTIONS = [
  "PRIMARY",
  "LANDLORD",
  "SERVICE_PROVIDER",
  "BILLING_ENTITY",
  "AGENT",
  "BROKER",
  "INSURER",
  "FINANCIER",
  "LICENSOR",
  "OTHER",
] as const;

export const OBLIGATION_CATEGORY_SUGGESTIONS = [
  "TENANCY",
  "LEASE",
  "SUBSCRIPTION",
  "INSURANCE",
  "FLEET",
  "VEHICLE_FINANCE",
  "HIRE_PURCHASE",
  "MAINTENANCE",
  "SERVICE_CONTRACT",
  "UTILITIES",
  "LICENCE_PERMIT",
  "TAX_FEE",
  "MEMBERSHIP",
  "PROFESSIONAL_SERVICE",
  "OTHER",
] as const;

export const PAYMENT_METHOD_SUGGESTIONS = [
  "BANK_TRANSFER",
  "DUITNOW",
  "GIRO",
  "DIRECT_DEBIT",
  "CREDIT_CARD",
  "CHEQUE",
  "CASH",
  "OTHER",
] as const;

export const recurrenceUnits = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type RecurrenceUnit = (typeof recurrenceUnits)[number];

export const customFieldScopes = ["COUNTERPARTY", "SITE", "OBLIGATION", "DUE_ITEM", "PAYMENT"] as const;
export type CustomFieldScope = (typeof customFieldScopes)[number];

export const customFieldTypes = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "SELECT",
  "URL",
  "EMAIL",
  "PHONE",
] as const;
export type CustomFieldType = (typeof customFieldTypes)[number];

export const obligationStatuses = ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"] as const;
export type ObligationStatus = (typeof obligationStatuses)[number];

export const dueItemStatuses = ["OPEN", "COMPLETED", "CANCELLED"] as const;
export type DueItemStatus = (typeof dueItemStatuses)[number];

export const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const paymentStatuses = ["NOT_PAID", "PARTIALLY_PAID", "PAID", "VOIDED"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date");

const optionalTrimmed = z.string().trim().max(500).optional().nullable();
const optionalLongText = z.string().trim().max(10_000).optional().nullable();
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");
const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code").optional().nullable().or(z.literal(""));
const customFields = z.record(z.string(), z.unknown()).default({});

/**
 * Reference codes are optional. Every create form labels the field "Auto-generated if
 * blank" and POSTs its draft verbatim, so a blank field arrives as "" rather than
 * undefined — it must parse so the route's `?? newReferenceCode(...)` fallback can run.
 * A one-character code remains a typo and stays rejected.
 */
const referenceCode = (max: number) =>
  z.string().trim().min(2).max(max).optional().nullable().or(z.literal(""));

export const createCounterpartySchema = z.object({
  code: referenceCode(40),
  name: z.string().trim().min(1).max(240),
  type: z.string().trim().min(1).max(80),
  registrationNo: optionalTrimmed,
  taxId: optionalTrimmed,
  contactName: optionalTrimmed,
  contactEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  contactPhone: optionalTrimmed,
  address: optionalLongText,
  countryCode,
  websiteUrl: z.string().trim().url().max(2_000).optional().nullable().or(z.literal("")),
  defaultCurrency: currency.optional().nullable().or(z.literal("")),
  paymentTermsDays: z.number().int().min(0).max(3650).optional().nullable(),
  isActive: z.boolean().default(true),
  notes: optionalLongText,
  customFields,
});

export const createSiteSchema = z.object({
  code: referenceCode(50),
  name: z.string().trim().min(1).max(240),
  type: z.string().trim().min(1).max(100),
  organization: z.string().trim().max(160).optional().nullable(),
  addressLine1: optionalTrimmed,
  addressLine2: optionalTrimmed,
  city: z.string().trim().max(160).optional().nullable(),
  stateRegion: z.string().trim().max(160).optional().nullable(),
  postalCode: z.string().trim().max(40).optional().nullable(),
  countryCode,
  timezone: z.string().trim().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isActive: z.boolean().default(true),
  notes: optionalLongText,
  customFields,
});

export const createCounterpartyContactSchema = z.object({
  name: z.string().trim().min(1).max(240),
  jobTitle: optionalTrimmed,
  department: optionalTrimmed,
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  phone: optionalTrimmed,
  mobile: optionalTrimmed,
  role: optionalTrimmed,
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: optionalLongText,
});

export const createServiceCoverageSchema = z
  .object({
    counterpartyId: z.string().trim().min(1),
    serviceCategory: z.string().trim().min(1).max(120),
    roleCode: z.string().trim().max(120).optional().nullable(),
    effectiveFrom: dateOnly.optional().nullable(),
    effectiveTo: dateOnly.optional().nullable(),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true),
    serviceLevel: optionalTrimmed,
    emergencyContact: optionalTrimmed,
    notes: optionalLongText,
  })
  .superRefine((value, ctx) => {
    if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective-to date cannot be before effective-from date" });
    }
  });

export const createObligationSiteSchema = z.object({
  siteId: z.string().trim().min(1),
  scopeRole: z.string().trim().max(120).optional().nullable(),
  notes: optionalLongText,
});

export const createObligationPartySchema = z
  .object({
    counterpartyId: z.string().trim().min(1),
    roleCode: z.string().trim().min(1).max(120),
    isPrimary: z.boolean().default(false),
    effectiveFrom: dateOnly.optional().nullable(),
    effectiveTo: dateOnly.optional().nullable(),
    notes: optionalLongText,
  })
  .superRefine((value, ctx) => {
    if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective-to date cannot be before effective-from date" });
    }
  });

export const createObligationSchema = z
  .object({
    code: referenceCode(50),
    organization: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(240),
    counterpartyId: z.string().trim().min(1),
    assetReference: optionalTrimmed,
    ownerId: z.string().trim().min(1).optional().nullable(),
    startDate: dateOnly,
    endDate: dateOnly.optional().nullable(),
    recurring: z.boolean().default(false),
    recurrenceInterval: z.number().int().min(1).max(120).optional().nullable(),
    recurrenceUnit: z.enum(recurrenceUnits).optional().nullable(),
    expectedAmount: z.number().min(0).max(999_999_999_999_999.99).optional().nullable(),
    currency,
    firstDueDate: dateOnly.optional().nullable(),
    nextDueDate: dateOnly.optional().nullable(),
    autoRenew: z.boolean().default(false),
    renewalDate: dateOnly.optional().nullable(),
    noticeDays: z.number().int().min(0).max(3650).optional().nullable(),
    contractRequired: z.boolean().default(false),
    contractReference: optionalTrimmed,
    contractFileUrl: z.string().trim().url().max(2_000).optional().nullable().or(z.literal("")),
    paymentMethod: optionalTrimmed,
    notes: optionalLongText,
    customFields,
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date" });
    }
    if (value.recurring && (!value.recurrenceInterval || !value.recurrenceUnit)) {
      ctx.addIssue({ code: "custom", path: ["recurrenceInterval"], message: "Recurring obligations need an interval and unit" });
    }
    if (!value.recurring && (value.recurrenceInterval || value.recurrenceUnit)) {
      ctx.addIssue({ code: "custom", path: ["recurring"], message: "Recurrence settings require recurring to be enabled" });
    }
    if (value.recurring && !value.nextDueDate && !value.firstDueDate) {
      ctx.addIssue({ code: "custom", path: ["firstDueDate"], message: "Recurring obligations need a first or next due date" });
    }
  });

export const patchObligationSchema = z.object({
  action: z.enum(["ACTIVATE", "END", "CANCEL"]),
});

export const createDueItemSchema = z.object({
  mode: z.enum(["NEXT", "MANUAL"]).default("NEXT"),
  dueDate: dateOnly.optional(),
  periodLabel: z.string().trim().min(1).max(80).optional(),
  expectedAmount: z.number().min(0).optional().nullable(),
  invoiceAmount: z.number().min(0).optional().nullable(),
  currency: currency.optional(),
  invoiceRequired: z.boolean().optional(),
  invoiceNumber: optionalTrimmed,
  invoiceFileUrl: z.string().trim().url().max(2_000).optional().nullable().or(z.literal("")),
  disputeFlag: z.boolean().optional(),
  notes: optionalLongText,
  customFields,
});

export const createPaymentRequestSchema = z.object({
  requestedAmount: z.number().positive().max(999_999_999_999_999.99),
  notes: optionalLongText,
  customFields,
});

export const paymentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE"), approvedAmount: z.number().positive() }),
  z.object({ action: z.literal("REJECT"), notes: optionalLongText }),
  z.object({
    action: z.literal("RECORD_PAYMENT"),
    paidAmount: z.number().positive(),
    paymentDate: dateOnly,
    paymentMethod: z.string().trim().min(1).max(100),
    paymentReference: z.string().trim().max(500).optional().nullable(),
    paymentProofUrl: z.string().trim().url().max(2_000).optional().nullable().or(z.literal("")),
  }),
  z.object({ action: z.literal("RECONCILE") }),
  z.object({ action: z.literal("VOID"), notes: optionalLongText }),
]);

export const customFieldDefinitionSchema = z
  .object({
    scope: z.enum(customFieldScopes),
    key: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores; start with a letter"),
    label: z.string().trim().min(1).max(120),
    dataType: z.enum(customFieldTypes),
    description: z.string().trim().max(500).optional().nullable(),
    placeholder: z.string().trim().max(200).optional().nullable(),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(120)).max(100).optional().nullable(),
    showInList: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.dataType === "SELECT" && (!value.options || value.options.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Select fields need at least one option" });
    }
  });

export const customFieldDefinitionPatchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  placeholder: z.string().trim().max(200).optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(100).optional().nullable(),
  showInList: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function nextOccurrence(date: string, interval: number, unit: RecurrenceUnit): string {
  if (!Number.isInteger(interval) || interval < 1) throw new Error("Recurrence interval must be a positive integer");
  const source = parseDateOnly(date);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();

  if (unit === "DAY") {
    source.setUTCDate(day + interval);
    return formatDateOnly(source);
  }
  if (unit === "WEEK") {
    source.setUTCDate(day + interval * 7);
    return formatDateOnly(source);
  }

  const sourceIsMonthEnd = day === daysInMonth(year, month);
  if (unit === "MONTH") {
    const absoluteMonth = month + interval;
    const targetYear = year + Math.floor(absoluteMonth / 12);
    const targetMonth = ((absoluteMonth % 12) + 12) % 12;
    const targetLastDay = daysInMonth(targetYear, targetMonth);
    const targetDay = sourceIsMonthEnd ? targetLastDay : Math.min(day, targetLastDay);
    return formatDateOnly(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
  }

  const targetYear = year + interval;
  const targetLastDay = daysInMonth(targetYear, month);
  const targetDay = sourceIsMonthEnd ? targetLastDay : Math.min(day, targetLastDay);
  return formatDateOnly(new Date(Date.UTC(targetYear, month, targetDay)));
}

export function defaultPeriodLabel(dueDate: string): string {
  return dueDate.slice(0, 7);
}

export type DisplayDueState = "UPCOMING" | "DUE" | "OVERDUE" | "COMPLETED" | "CANCELLED";

export function deriveDueState(status: DueItemStatus, dueDate: string, today: string): DisplayDueState {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  if (dueDate < today) return "OVERDUE";
  if (dueDate === today) return "DUE";
  return "UPCOMING";
}

const OBLIGATION_TRANSITIONS: Record<ObligationStatus, readonly ObligationStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ENDED", "CANCELLED"],
  ENDED: [],
  CANCELLED: [],
};

export function assertObligationTransition(from: ObligationStatus, to: ObligationStatus): void {
  if (!OBLIGATION_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid obligation transition: ${from} -> ${to}`);
  }
}

export function cleanOptionalString(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function newReferenceCode(prefix: "CP" | "SITE" | "ADM"): string {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `${prefix}-${year}-${suffix}`;
}

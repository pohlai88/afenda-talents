import { z } from "zod";

export const cleanupResolutionActions = [
  "SET_PRIMARY_CONTACT",
  "DEACTIVATE_CONTACT",
  "SET_PRIMARY_COVERAGE",
  "DEACTIVATE_COVERAGE",
  "SET_PRIMARY_OBLIGATION_PARTY",
] as const;
export type CleanupResolutionAction = (typeof cleanupResolutionActions)[number];

export const cleanupResolutionRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_PRIMARY_CONTACT"), counterpartyId: z.string().min(1), contactId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("DEACTIVATE_CONTACT"), counterpartyId: z.string().min(1), contactId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("SET_PRIMARY_COVERAGE"), siteId: z.string().min(1), coverageId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("DEACTIVATE_COVERAGE"), siteId: z.string().min(1), coverageId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("SET_PRIMARY_OBLIGATION_PARTY"), obligationId: z.string().min(1), counterpartyId: z.string().min(1), roleCode: z.string().trim().min(1).max(120) }).strict(),
]);

export const cleanupResolutionCommitSchema = z.object({
  request: cleanupResolutionRequestSchema,
  previewHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export type CleanupResolutionRequest = z.infer<typeof cleanupResolutionRequestSchema>;
export type CleanupResolutionChange = { field: string; before: string | boolean | null; after: string | boolean | null };
export type CleanupResolutionPlan = {
  action: CleanupResolutionAction;
  subject: { type: "CONTACT" | "COVERAGE" | "OBLIGATION_PARTY"; id: string; label: string };
  changes: CleanupResolutionChange[];
  previewHash: string;
};

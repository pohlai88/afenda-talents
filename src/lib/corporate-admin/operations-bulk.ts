import { z } from "zod";

const idList = z.array(z.string().trim().min(1)).min(1).max(200).transform((ids) => Array.from(new Set(ids)));

export const corporateBulkOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_LINE_ACTIVE"),
    lineIds: idList,
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal("LINK_SITE"),
    obligationIds: idList,
    siteId: z.string().trim().min(1),
    scopeRole: z.string().trim().max(80).optional().nullable(),
  }),
]);

export type CorporateBulkOperation = z.infer<typeof corporateBulkOperationSchema>;

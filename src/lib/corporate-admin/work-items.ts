import { z } from "zod";

export const WORK_ITEM_STATUSES = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;
export const WORK_ITEM_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export const WORK_ITEM_SOURCE_TYPES = ["SITE", "COUNTERPARTY", "OBLIGATION", "LINE", "DUE_ITEM", "PAYMENT", "DATA_QUALITY"] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];
export type WorkItemSourceType = (typeof WORK_ITEM_SOURCE_TYPES)[number];

const optionalText = z.string().trim().max(2000).optional().nullable();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createWorkItemSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: optionalText,
  priority: z.enum(WORK_ITEM_PRIORITIES).default("NORMAL"),
  ownerId: z.string().min(1).optional().nullable(),
  sourceType: z.enum(WORK_ITEM_SOURCE_TYPES),
  sourceId: z.string().max(200).optional().nullable(),
  sourceKey: z.string().max(300).optional().nullable(),
  sourceHref: z.string().startsWith("/admin/corporate").max(500).optional().nullable(),
  dueDate: dateOnly.optional().nullable(),
  escalateAfter: dateOnly.optional().nullable(),
});

export const updateWorkItemSchema = z.object({
  ownerId: z.string().min(1).optional().nullable(),
  dueDate: dateOnly.optional().nullable(),
  priority: z.enum(WORK_ITEM_PRIORITIES).optional(),
  status: z.enum(WORK_ITEM_STATUSES).optional(),
  resolutionNote: optionalText,
});

export type WorkItemRow = {
  id: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  ownerId: string | null;
  ownerName: string | null;
  sourceType: WorkItemSourceType;
  sourceId: string | null;
  sourceKey: string | null;
  sourceHref: string | null;
  dueDate: string | null;
  escalationLevel: number;
  escalateAfter: string | null;
  escalatedAt: Date | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function daysPast(date: string, today: string): number {
  const start = Date.parse(`${date}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000);
}

export function deriveEscalationLevel(status: WorkItemStatus, dueDate: string | null, today: string): 0 | 1 | 2 | 3 {
  if (status === "RESOLVED" || status === "CANCELLED" || !dueDate) return 0;
  const overdue = daysPast(dueDate, today);
  if (overdue < 1) return 0;
  if (overdue < 3) return 1;
  if (overdue < 7) return 2;
  return 3;
}

export function workItemAttention(item: Pick<WorkItemRow, "status" | "dueDate" | "escalationLevel">, today: string): "RESOLVED" | "OVERDUE" | "DUE_SOON" | "OPEN" {
  if (item.status === "RESOLVED" || item.status === "CANCELLED") return "RESOLVED";
  if (item.dueDate && item.dueDate < today) return "OVERDUE";
  if (item.dueDate) {
    const delta = -daysPast(item.dueDate, today);
    if (delta <= 7) return "DUE_SOON";
  }
  return "OPEN";
}

import { z } from "zod";

import { daysPast, type WorkItemRow } from "@/lib/corporate-admin/work-items";

export type ControlTowerBucket = "TODAY" | "THIS_WEEK" | "ESCALATED" | "AWAITING_ME" | "UNASSIGNED";
export type ReminderChannel = "IN_APP" | "EMAIL";
export type ReminderStatus = "QUEUED" | "SENT" | "BLOCKED" | "FAILED";

export const sendReminderSchema = z.object({
  workItemId: z.string().min(1),
  channel: z.enum(["IN_APP", "EMAIL"]),
});

export type ReminderDeliveryRow = {
  id: string;
  workItemId: string;
  recipientUserId: string | null;
  recipientName: string | null;
  channel: ReminderChannel;
  status: ReminderStatus;
  subject: string;
  failureCode: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

export function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function unresolved(item: Pick<WorkItemRow, "status">): boolean {
  return item.status !== "RESOLVED" && item.status !== "CANCELLED";
}

export function inBucket(item: WorkItemRow, bucket: ControlTowerBucket, today: string, userId: string): boolean {
  if (!unresolved(item)) return false;
  const weekEnd = addDays(today, 7);
  if (bucket === "TODAY") return Boolean(item.dueDate && item.dueDate <= today);
  if (bucket === "THIS_WEEK") return Boolean(item.dueDate && item.dueDate >= today && item.dueDate <= weekEnd);
  if (bucket === "ESCALATED") return item.escalationLevel > 0;
  if (bucket === "AWAITING_ME") return item.ownerId === userId;
  return !item.ownerId;
}

export function reminderEligible(item: WorkItemRow, today: string): boolean {
  if (!unresolved(item) || !item.ownerId) return false;
  if (item.escalationLevel > 0) return true;
  return Boolean(item.dueDate && item.dueDate <= addDays(today, 7));
}

export function reminderCopy(item: WorkItemRow, today: string): { subject: string; body: string } {
  const overdue = item.dueDate ? daysPast(item.dueDate, today) : 0;
  const timing = item.dueDate
    ? overdue > 0
      ? `${overdue} day${overdue === 1 ? "" : "s"} overdue`
      : item.dueDate === today
        ? "due today"
        : `due ${item.dueDate}`
    : "requires attention";
  return {
    subject: `[Afenda] ${item.priority} administrative work — ${item.title}`,
    body: `${item.title}\n\nStatus: ${item.status}\nPriority: ${item.priority}\nTiming: ${timing}\nEscalation: L${item.escalationLevel}\n\nOpen the Corporate Administration Work Queue to review and update this item.`,
  };
}

export function managementSummary(items: WorkItemRow[], today: string): { open: number; dueToday: number; dueThisWeek: number; overdue: number; escalated: number; unassigned: number } {
  const open = items.filter(unresolved);
  const weekEnd = addDays(today, 7);
  return {
    open: open.length,
    dueToday: open.filter(item => item.dueDate === today).length,
    dueThisWeek: open.filter(item => item.dueDate && item.dueDate >= today && item.dueDate <= weekEnd).length,
    overdue: open.filter(item => item.dueDate && item.dueDate < today).length,
    escalated: open.filter(item => item.escalationLevel > 0).length,
    unassigned: open.filter(item => !item.ownerId).length,
  };
}

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { listWorkItems } from "@/lib/corporate-admin/work-items-server";
import { deriveEscalationLevel, type WorkItemRow } from "@/lib/corporate-admin/work-items";
import { reminderCopy, reminderEligible, sendReminderSchema, type ReminderDeliveryRow } from "@/lib/corporate-admin/control-tower";

export async function listReminderDeliveries(limit = 100): Promise<ReminderDeliveryRow[]> {
  return db.$queryRaw<ReminderDeliveryRow[]>(Prisma.sql`
    SELECT r."id", r."workItemId", r."recipientUserId", u."name" AS "recipientName",
      r."channel", r."status", r."subject", r."failureCode", r."providerMessageId", r."sentAt", r."createdAt"
    FROM "AdministrativeReminderDelivery" r
    LEFT JOIN "User" u ON u."id" = r."recipientUserId"
    ORDER BY r."createdAt" DESC
    LIMIT ${Math.max(1, Math.min(limit, 500))}
  `);
}

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Kuala_Lumpur", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}
function withCurrentEscalation(item: WorkItemRow, today: string): WorkItemRow {
  return { ...item, escalationLevel: deriveEscalationLevel(item.status, item.dueDate, today) };
}

async function reserveDelivery(input: {
  workItemId: string;
  recipientUserId: string | null;
  channel: "IN_APP" | "EMAIL";
  deliveryKey: string;
  subject: string;
  body: string;
  actorId: string;
}): Promise<{ id: string; created: boolean }> {
  const id = randomUUID();
  const rows = await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
    INSERT INTO "AdministrativeReminderDelivery" (
      "id","workItemId","recipientUserId","channel","status","deliveryKey","subject","body","createdById"
    ) VALUES (
      ${id},${input.workItemId},${input.recipientUserId},${input.channel},'QUEUED',${input.deliveryKey},${input.subject},${input.body},${input.actorId}
    )
    ON CONFLICT ("deliveryKey") DO NOTHING
    RETURNING "id"
  `);
  return rows[0] ? { id: rows[0].id, created: true } : { id, created: false };
}

async function markDelivery(id: string, status: "SENT" | "BLOCKED" | "FAILED", providerMessageId?: string | null, failureCode?: string | null): Promise<void> {
  await db.$executeRaw(Prisma.sql`
    UPDATE "AdministrativeReminderDelivery"
    SET "status"=${status}, "providerMessageId"=${providerMessageId ?? null}, "failureCode"=${failureCode ?? null},
      "sentAt"=${status === "SENT" ? new Date() : null}
    WHERE "id"=${id}
  `);
}

export async function generateInAppReminders(actorId: string, today = todayLocal()): Promise<{ created: number; skipped: number }> {
  const items = (await listWorkItems()).map(item => withCurrentEscalation(item, today));
  let created = 0;
  let skipped = 0;
  for (const item of items.filter(item => reminderEligible(item, today))) {
    const copy = reminderCopy(item, today);
    const deliveryKey = `inapp:${item.id}:${item.ownerId}:${today}:L${item.escalationLevel}`;
    const reserved = await reserveDelivery({ workItemId:item.id, recipientUserId:item.ownerId, channel:"IN_APP", deliveryKey, subject:copy.subject, body:copy.body, actorId });
    if (!reserved.created) { skipped++; continue; }
    await markDelivery(reserved.id, "SENT");
    await audit(actorId, "corporate.reminder.sent", item.id, { channel:"IN_APP", recipientUserId:item.ownerId ?? undefined, deliveryId:reserved.id });
    created++;
  }
  return { created, skipped };
}

export async function sendReminder(input: unknown, actorId: string, today = todayLocal()): Promise<{ status: "SENT" | "BLOCKED" | "FAILED" | "SKIPPED"; deliveryId?: string }> {
  const data = sendReminderSchema.parse(input);
  const rawItem = (await listWorkItems()).find(row => row.id === data.workItemId);
  if (!rawItem) throw new Error("Work item not found");
  const item = withCurrentEscalation(rawItem, today);
  if (!item.ownerId) throw new Error("Assign an owner before sending a reminder");
  const owner = await db.user.findUnique({ where:{ id:item.ownerId }, select:{ id:true, email:true } });
  if (!owner) throw new Error("Work item owner not found");

  const copy = reminderCopy(item, today);
  const deliveryKey = `${data.channel.toLowerCase()}:${item.id}:${owner.id}:${today}:L${item.escalationLevel}`;
  const reserved = await reserveDelivery({ workItemId:item.id, recipientUserId:owner.id, channel:data.channel, deliveryKey, subject:copy.subject, body:copy.body, actorId });
  if (!reserved.created) return { status:"SKIPPED" };

  if (data.channel === "IN_APP") {
    await markDelivery(reserved.id, "SENT");
    await audit(actorId, "corporate.reminder.sent", item.id, { channel:"IN_APP", recipientUserId:owner.id, deliveryId:reserved.id });
    return { status:"SENT", deliveryId:reserved.id };
  }

  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    await markDelivery(reserved.id, "BLOCKED", null, "EMAIL_TRANSPORT_NOT_CONFIGURED");
    await audit(actorId, "corporate.reminder.blocked", item.id, { channel:"EMAIL", recipientUserId:owner.id, deliveryId:reserved.id, failureCode:"EMAIL_TRANSPORT_NOT_CONFIGURED" });
    return { status:"BLOCKED", deliveryId:reserved.id };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{ Authorization:`Bearer ${env.RESEND_API_KEY}`, "Content-Type":"application/json" },
      body:JSON.stringify({ from:env.MAIL_FROM, to:[owner.email], subject:copy.subject, text:copy.body }),
    });
    if (!response.ok) {
      const failureCode = `RESEND_HTTP_${response.status}`;
      await markDelivery(reserved.id, "FAILED", null, failureCode);
      await audit(actorId, "corporate.reminder.failed", item.id, { channel:"EMAIL", recipientUserId:owner.id, deliveryId:reserved.id, failureCode });
      return { status:"FAILED", deliveryId:reserved.id };
    }
    const payload = await response.json().catch(()=>({})) as { id?: string };
    await markDelivery(reserved.id, "SENT", payload.id ?? null, null);
    await audit(actorId, "corporate.reminder.sent", item.id, { channel:"EMAIL", recipientUserId:owner.id, deliveryId:reserved.id });
    return { status:"SENT", deliveryId:reserved.id };
  } catch {
    await markDelivery(reserved.id, "FAILED", null, "EMAIL_TRANSPORT_ERROR");
    await audit(actorId, "corporate.reminder.failed", item.id, { channel:"EMAIL", recipientUserId:owner.id, deliveryId:reserved.id, failureCode:"EMAIL_TRANSPORT_ERROR" });
    return { status:"FAILED", deliveryId:reserved.id };
  }
}

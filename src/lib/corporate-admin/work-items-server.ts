import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createWorkItemSchema, deriveEscalationLevel, updateWorkItemSchema, type WorkItemRow } from "@/lib/corporate-admin/work-items";

function nullableText(value: string | null | undefined): string | null { return value?.trim() ? value.trim() : null; }

export async function listWorkItems(): Promise<WorkItemRow[]> {
  return db.$queryRaw<WorkItemRow[]>(Prisma.sql`
    SELECT w."id", w."title", w."description", w."status", w."priority",
      w."ownerId", u."name" AS "ownerName", w."sourceType", w."sourceId", w."sourceKey", w."sourceHref",
      to_char(w."dueDate", 'YYYY-MM-DD') AS "dueDate", w."escalationLevel",
      to_char(w."escalateAfter", 'YYYY-MM-DD') AS "escalateAfter", w."escalatedAt",
      w."acknowledgedAt", w."resolvedAt", w."resolutionNote", w."createdAt", w."updatedAt"
    FROM "AdministrativeWorkItem" w
    LEFT JOIN "User" u ON u."id" = w."ownerId"
    ORDER BY
      CASE w."status" WHEN 'OPEN' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,
      CASE w."priority" WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
      w."dueDate" NULLS LAST, w."createdAt" DESC
  `);
}

export async function createWorkItem(input: unknown, actorId: string): Promise<string> {
  const data = createWorkItemSchema.parse(input);
  const id = randomUUID();
  const ownerId = nullableText(data.ownerId);
  if (ownerId) {
    const owner = await db.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) throw new Error("Owner not found");
  }
  try {
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "AdministrativeWorkItem" (
        "id","title","description","priority","ownerId","sourceType","sourceId","sourceKey","sourceHref","dueDate","escalateAfter","createdById"
      ) VALUES (
        ${id}, ${data.title}, ${nullableText(data.description)}, ${data.priority}, ${ownerId}, ${data.sourceType},
        ${nullableText(data.sourceId)}, ${nullableText(data.sourceKey)}, ${nullableText(data.sourceHref)},
        ${data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null},
        ${data.escalateAfter ? new Date(`${data.escalateAfter}T00:00:00Z`) : null}, ${actorId}
      )
    `);
  } catch (error) {
    if (error instanceof Error && error.message.includes("AdministrativeWorkItem_sourceKey_key")) throw new Error("A work item already exists for this source");
    throw error;
  }
  await audit(actorId, "corporate.work_item.created", id, { sourceType: data.sourceType, sourceId: data.sourceId ?? undefined, ownerId: ownerId ?? undefined });
  return id;
}

export async function updateWorkItem(id: string, input: unknown, actorId: string): Promise<void> {
  const data = updateWorkItemSchema.parse(input);
  const current = await db.$queryRaw<Array<{status:string;ownerId:string|null;dueDate:Date|null;priority:string}>>(Prisma.sql`
    SELECT "status","ownerId","dueDate","priority" FROM "AdministrativeWorkItem" WHERE "id"=${id} FOR UPDATE
  `);
  if (!current[0]) throw new Error("Work item not found");
  if (data.ownerId) {
    const owner = await db.user.findUnique({ where: { id: data.ownerId }, select: { id: true } });
    if (!owner) throw new Error("Owner not found");
  }
  const status = data.status ?? current[0].status;
  const now = new Date();
  await db.$executeRaw(Prisma.sql`
    UPDATE "AdministrativeWorkItem" SET
      "ownerId" = ${data.ownerId === undefined ? current[0].ownerId : nullableText(data.ownerId)},
      "dueDate" = ${data.dueDate === undefined ? current[0].dueDate : data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null},
      "priority" = ${data.priority ?? current[0].priority},
      "status" = ${status},
      "acknowledgedAt" = ${status === "ACKNOWLEDGED" && current[0].status === "OPEN" ? now : Prisma.sql`"acknowledgedAt"`},
      "acknowledgedById" = ${status === "ACKNOWLEDGED" && current[0].status === "OPEN" ? actorId : Prisma.sql`"acknowledgedById"`},
      "resolvedAt" = ${status === "RESOLVED" ? now : status === "CANCELLED" ? Prisma.sql`"resolvedAt"` : null},
      "resolvedById" = ${status === "RESOLVED" ? actorId : status === "CANCELLED" ? Prisma.sql`"resolvedById"` : null},
      "resolutionNote" = ${data.resolutionNote === undefined ? Prisma.sql`"resolutionNote"` : nullableText(data.resolutionNote)},
      "updatedAt" = ${now}
    WHERE "id"=${id}
  `);
  await audit(actorId, status === "RESOLVED" ? "corporate.work_item.resolved" : "corporate.work_item.updated", id, { status, ownerId: data.ownerId ?? undefined });
}

export async function refreshEscalations(today: string, actorId: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{id:string;status:"OPEN"|"ACKNOWLEDGED"|"IN_PROGRESS"|"RESOLVED"|"CANCELLED";dueDate:Date|null;escalationLevel:number}>>(Prisma.sql`
    SELECT "id","status","dueDate","escalationLevel" FROM "AdministrativeWorkItem"
    WHERE "status" IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS')
  `);
  let changed = 0;
  for (const row of rows) {
    const due = row.dueDate ? row.dueDate.toISOString().slice(0,10) : null;
    const level = deriveEscalationLevel(row.status, due, today);
    if (level === row.escalationLevel) continue;
    await db.$executeRaw(Prisma.sql`
      UPDATE "AdministrativeWorkItem" SET "escalationLevel"=${level}, "escalatedAt"=${level > row.escalationLevel ? new Date() : null}, "updatedAt"=${new Date()} WHERE "id"=${row.id}
    `);
    await audit(actorId, "corporate.work_item.escalated", row.id, { fromLevel: row.escalationLevel, toLevel: level });
    changed++;
  }
  return changed;
}

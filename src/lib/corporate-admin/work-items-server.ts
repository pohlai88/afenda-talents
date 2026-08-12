import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { createWorkItemSchema, deriveEscalationLevel, updateWorkItemSchema, type WorkItemRow, type WorkItemStatus } from "@/lib/corporate-admin/work-items";
import { db } from "@/lib/db";

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
  const rows = await db.$queryRaw<Array<{status:WorkItemStatus;ownerId:string|null}>>(Prisma.sql`
    SELECT "status","ownerId" FROM "AdministrativeWorkItem" WHERE "id"=${id}
  `);
  const current = rows[0];
  if (!current) throw new Error("Work item not found");
  if (data.ownerId) {
    const owner = await db.user.findUnique({ where: { id: data.ownerId }, select: { id: true } });
    if (!owner) throw new Error("Owner not found");
  }

  const now = new Date();
  const sets: Prisma.Sql[] = [Prisma.sql`"updatedAt"=${now}`];
  if (data.ownerId !== undefined) sets.push(Prisma.sql`"ownerId"=${nullableText(data.ownerId)}`);
  if (data.dueDate !== undefined) sets.push(Prisma.sql`"dueDate"=${data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null}`);
  if (data.priority !== undefined) sets.push(Prisma.sql`"priority"=${data.priority}`);
  if (data.resolutionNote !== undefined) sets.push(Prisma.sql`"resolutionNote"=${nullableText(data.resolutionNote)}`);
  if (data.status !== undefined) {
    sets.push(Prisma.sql`"status"=${data.status}`);
    if (data.status === "ACKNOWLEDGED" && current.status === "OPEN") {
      sets.push(Prisma.sql`"acknowledgedAt"=${now}`, Prisma.sql`"acknowledgedById"=${actorId}`);
    }
    if (data.status === "RESOLVED") {
      sets.push(Prisma.sql`"resolvedAt"=${now}`, Prisma.sql`"resolvedById"=${actorId}`);
    } else if (current.status === "RESOLVED") {
      sets.push(Prisma.sql`"resolvedAt"=${null}`, Prisma.sql`"resolvedById"=${null}`);
    }
  }
  await db.$executeRaw(Prisma.sql`UPDATE "AdministrativeWorkItem" SET ${Prisma.join(sets, ", ")} WHERE "id"=${id}`);
  const status = data.status ?? current.status;
  await audit(actorId, status === "RESOLVED" ? "corporate.work_item.resolved" : "corporate.work_item.updated", id, { status, ownerId: data.ownerId ?? undefined });
}

async function insertGeneratedWorkItem(input: Parameters<typeof createWorkItemSchema.parse>[0], actorId: string): Promise<boolean> {
  const data = createWorkItemSchema.parse(input);
  const id = randomUUID();
  const count = await db.$executeRaw(Prisma.sql`
    INSERT INTO "AdministrativeWorkItem" (
      "id","title","description","priority","ownerId","sourceType","sourceId","sourceKey","sourceHref","dueDate","escalateAfter","createdById"
    ) VALUES (
      ${id}, ${data.title}, ${nullableText(data.description)}, ${data.priority}, ${nullableText(data.ownerId)}, ${data.sourceType},
      ${nullableText(data.sourceId)}, ${nullableText(data.sourceKey)}, ${nullableText(data.sourceHref)},
      ${data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null}, ${data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null}, ${actorId}
    ) ON CONFLICT ("sourceKey") WHERE "sourceKey" IS NOT NULL DO NOTHING
  `);
  if (count === 0) return false;
  await audit(actorId, "corporate.work_item.created", id, { sourceType: data.sourceType, sourceId: data.sourceId ?? undefined, ownerId: data.ownerId ?? undefined, generated: true });
  return true;
}

export async function materializeOperationalWorkItems(today: string, actorId: string): Promise<number> {
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 7);
  const [dues, missingSchedules] = await Promise.all([
    db.obligationDueItem.findMany({
      where: { status: "OPEN", dueDate: { lte: horizon } },
      select: {
        id: true, dueDate: true, periodLabel: true,
        obligation: { select: { id: true, code: true, title: true, ownerId: true } },
        line: { select: { code: true, name: true } },
      },
      orderBy: { dueDate: "asc" }, take: 200,
    }),
    db.administrativeObligationLine.findMany({
      where: { isActive: true, recurring: true, nextDueDate: null, obligation: { status: "ACTIVE" } },
      select: { id: true, code: true, name: true, obligation: { select: { id: true, code: true, title: true, ownerId: true } } },
      take: 100,
    }),
  ]);
  let created = 0;
  for (const due of dues) {
    const dueDate = due.dueDate.toISOString().slice(0,10);
    if (await insertGeneratedWorkItem({
      title: `${due.obligation.code} · ${due.line.code} due ${dueDate}`,
      description: `${due.obligation.title} / ${due.line.name} / ${due.periodLabel}`,
      priority: dueDate < today ? "HIGH" : "NORMAL",
      ownerId: due.obligation.ownerId,
      sourceType: "DUE_ITEM",
      sourceId: due.id,
      sourceKey: `due-item:${due.id}`,
      sourceHref: `/admin/corporate/obligations/${due.obligation.id}`,
      dueDate,
    }, actorId)) created++;
  }
  for (const line of missingSchedules) {
    if (await insertGeneratedWorkItem({
      title: `${line.obligation.code} · ${line.code} needs next due date`,
      description: `${line.obligation.title} / ${line.name} is active and recurring but has no next-due pointer.`,
      priority: "HIGH",
      ownerId: line.obligation.ownerId,
      sourceType: "LINE",
      sourceId: line.id,
      sourceKey: `line-next-due:${line.id}`,
      sourceHref: `/admin/corporate/obligations/${line.obligation.id}/lines`,
      dueDate: today,
    }, actorId)) created++;
  }
  return created;
}

export async function refreshEscalations(today: string, actorId: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{id:string;status:WorkItemStatus;dueDate:Date|null;escalationLevel:number}>>(Prisma.sql`
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

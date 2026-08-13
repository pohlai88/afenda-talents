import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { closeFileSchema, closureBlockers, closureUpsertSchema } from "@/lib/corporate-admin/settlement";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function malaysiaDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = closureUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid termination details" }, { status: 400 });
  }
  const { id: obligationId } = await context.params;

  try {
    const closure = await db.$transaction(async (tx) => {
      const obligation = await tx.administrativeObligation.findUnique({ where: { id: obligationId }, select: { id: true, status: true, nextDueDate: true } });
      if (!obligation) throw new Error("Obligation not found");
      if (obligation.status === "DRAFT") throw new Error("Activate or cancel the obligation before starting settlement and closure");

      const existing = await tx.administrativeClosure.findUnique({ where: { obligationId } });
      if (existing?.status === "CLOSED") throw new Error("Closed files cannot be changed");

      const effective = parseDateOnly(parsed.data.effectiveDate);
      const effectiveNow = parsed.data.effectiveDate <= malaysiaDateOnly();
      const data = {
        status: "RECONCILING" as const,
        terminationType: parsed.data.terminationType,
        noticeDate: parsed.data.noticeDate ? parseDateOnly(parsed.data.noticeDate) : null,
        effectiveDate: effective,
        handoverDate: parsed.data.handoverDate ? parseDateOnly(parsed.data.handoverDate) : null,
        terminationReason: parsed.data.terminationReason,
        terminationDocumentUrl: cleanOptionalString(parsed.data.terminationDocumentUrl),
        notes: cleanOptionalString(parsed.data.notes),
      };

      const record = existing
        ? await tx.administrativeClosure.update({ where: { id: existing.id }, data })
        : await tx.administrativeClosure.create({ data: { obligationId, createdById: session.userId, ...data } });

      if (obligation.status === "ACTIVE") {
        await tx.administrativeObligationLine.updateMany({
          where: { obligationId, isActive: true, OR: [{ endDate: null }, { endDate: { gt: effective } }] },
          data: { endDate: effective },
        });
        await tx.administrativeObligationLine.updateMany({
          where: { obligationId, nextDueDate: { gt: effective } },
          data: { nextDueDate: null },
        });
        if (effectiveNow) {
          await tx.administrativeObligationLine.updateMany({ where: { obligationId, isActive: true }, data: { nextDueDate: null } });
        }
        await tx.administrativeObligation.update({
          where: { id: obligationId },
          data: {
            status: effectiveNow ? "ENDED" : "ACTIVE",
            endDate: effective,
            nextDueDate: effectiveNow || (obligation.nextDueDate && obligation.nextDueDate > effective) ? null : obligation.nextDueDate,
            autoRenew: false,
            renewalDate: null,
          },
        });
      }

      await audit(session.userId, existing ? "corporate.closure.updated" : "corporate.closure.started", record.id, {
        closureId: record.id,
        obligationId,
        terminationType: parsed.data.terminationType,
        effectiveDate: parsed.data.effectiveDate,
        effectiveNow,
      }, tx);
      return record;
    });
    return NextResponse.json({ closure: { id: closure.id, status: closure.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save termination details";
    return NextResponse.json({ error: message }, { status: message === "Obligation not found" ? 404 : 409 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = closeFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid closure action" }, { status: 400 });
  const { id: obligationId } = await context.params;

  try {
    const result = await db.$transaction(async (tx) => {
      const closure = await tx.administrativeClosure.findUnique({ where: { obligationId } });
      if (!closure) throw new Error("Start termination and reconciliation before closing the file");

      const [openDueItems, pendingApprovals, unreconciledPayments, unresolvedReconciliationItems] = await Promise.all([
        tx.obligationDueItem.count({ where: { obligationId, status: "OPEN" } }),
        tx.administrativePayment.count({ where: { dueItem: { obligationId }, approvalStatus: "PENDING" } }),
        tx.administrativePayment.count({ where: { dueItem: { obligationId }, paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] }, reconciledAt: null } }),
        tx.administrativeReconciliationItem.count({ where: { closureId: closure.id, status: { in: ["OPEN", "DISPUTED"] } } }),
      ]);

      const blockers = closureBlockers({
        effectiveDate: closure.effectiveDate ? closure.effectiveDate.toISOString().slice(0, 10) : null,
        today: malaysiaDateOnly(),
        openDueItems,
        pendingApprovals,
        unreconciledPayments,
        unresolvedReconciliationItems,
        alreadyClosed: closure.status === "CLOSED",
      });
      if (blockers.length > 0) return { closed: false as const, blockers };

      const updated = await tx.administrativeClosure.update({
        where: { id: closure.id },
        data: { status: "CLOSED", closedAt: new Date(), closedById: session.userId },
      });
      const obligation = await tx.administrativeObligation.findUnique({ where: { id: obligationId }, select: { status: true } });
      if (obligation && obligation.status !== "CANCELLED" && obligation.status !== "ENDED") {
        await tx.administrativeObligation.update({ where: { id: obligationId }, data: { status: "ENDED", nextDueDate: null, autoRenew: false, renewalDate: null } });
        await tx.administrativeObligationLine.updateMany({ where: { obligationId, isActive: true }, data: { nextDueDate: null } });
      }
      await audit(session.userId, "corporate.closure.closed", updated.id, { closureId: updated.id, obligationId }, tx);
      return { closed: true as const, blockers: [] as string[] };
    });

    if (!result.closed) return NextResponse.json({ error: "File is not ready to close", blockers: result.blockers }, { status: 409 });
    return NextResponse.json({ closure: { status: "CLOSED" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not close file";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

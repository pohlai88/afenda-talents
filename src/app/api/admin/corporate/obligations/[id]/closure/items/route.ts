import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { reconciliationItemSchema } from "@/lib/corporate-admin/settlement";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = reconciliationItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reconciliation item" }, { status: 400 });
  const { id: obligationId } = await context.params;

  try {
    const item = await db.$transaction(async (tx) => {
      const closure = await tx.administrativeClosure.findUnique({ where: { obligationId } });
      if (!closure) throw new Error("Start termination and reconciliation before adding settlement items");
      if (closure.status === "CLOSED") throw new Error("Closed files cannot receive new reconciliation items");

      if (parsed.data.dueItemId) {
        const dueItem = await tx.obligationDueItem.findUnique({ where: { id: parsed.data.dueItemId }, select: { obligationId: true } });
        if (!dueItem || dueItem.obligationId !== obligationId) throw new Error("Linked due item does not belong to this obligation");
      }
      if (parsed.data.paymentId) {
        const payment = await tx.administrativePayment.findUnique({ where: { id: parsed.data.paymentId }, select: { dueItem: { select: { obligationId: true } } } });
        if (!payment || payment.dueItem.obligationId !== obligationId) throw new Error("Linked payment does not belong to this obligation");
      }

      const created = await tx.administrativeReconciliationItem.create({
        data: {
          closureId: closure.id,
          category: parsed.data.category,
          direction: parsed.data.direction,
          description: parsed.data.description,
          expectedAmount: parsed.data.expectedAmount ?? null,
          actualAmount: parsed.data.actualAmount ?? null,
          currency: parsed.data.currency,
          status: parsed.data.status,
          evidenceUrl: cleanOptionalString(parsed.data.evidenceUrl),
          dueItemId: parsed.data.dueItemId ?? null,
          paymentId: parsed.data.paymentId ?? null,
          notes: cleanOptionalString(parsed.data.notes),
          createdById: session.userId,
        },
      });
      await audit(session.userId, "corporate.reconciliation_item.created", created.id, {
        itemId: created.id,
        closureId: closure.id,
        obligationId,
        category: created.category,
        direction: created.direction,
      }, tx);
      return created;
    });
    return NextResponse.json({ item: { id: item.id, status: item.status } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add reconciliation item" }, { status: 409 });
  }
}

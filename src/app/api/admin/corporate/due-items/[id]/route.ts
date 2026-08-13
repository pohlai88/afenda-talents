import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { updateDueItemSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const dueItemActionSchema = z.object({
  action: z.literal("CANCEL"),
  notes: z.string().trim().max(10_000).optional().nullable(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = updateDueItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid due item" }, { status: 400 });
  const { id } = await context.params;
  const existing = await db.obligationDueItem.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Due item not found" }, { status: 404 });
  if (existing.status === "CANCELLED") return NextResponse.json({ error: "Cancelled due items are read-only" }, { status: 409 });

  try {
    const customFields = await validateAdministrativeCustomFields("DUE_ITEM", parsed.data.customFields);
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.obligationDueItem.update({
        where: { id },
        data: {
          periodLabel: parsed.data.periodLabel,
          dueDate: parseDateOnly(parsed.data.dueDate),
          expectedAmount: parsed.data.expectedAmount ?? null,
          invoiceAmount: parsed.data.invoiceAmount ?? null,
          currency: parsed.data.currency,
          invoiceRequired: parsed.data.invoiceRequired,
          invoiceNumber: cleanOptionalString(parsed.data.invoiceNumber),
          invoiceFileUrl: cleanOptionalString(parsed.data.invoiceFileUrl),
          disputeFlag: parsed.data.disputeFlag,
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });
      await audit(session.userId, "corporate.due_item.updated", id, { dueItemId: id, obligationId: record.obligationId }, tx);
      return record;
    });
    return NextResponse.json({ dueItem: { id: updated.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update due item";
    const duplicate = /unique constraint/i.test(message);
    return NextResponse.json({ error: duplicate ? "A due item already exists for that obligation and date" : message }, { status: duplicate ? 409 : 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = dueItemActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid due item action" }, { status: 400 });
  const { id } = await context.params;

  try {
    const updated = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ObligationDueItem" WHERE "id" = ${id} FOR UPDATE`;
      const dueItem = await tx.obligationDueItem.findUnique({
        where: { id },
        include: { payments: { select: { id: true, paymentStatus: true } } },
      });
      if (!dueItem) throw new Error("Due item not found");
      if (dueItem.status === "CANCELLED") throw new Error("Due item is already cancelled");
      const recorded = dueItem.payments.some((payment) => payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID");
      if (recorded) throw new Error("A due item with recorded payment history cannot be cancelled. Reconcile the payment and resolve any remaining balance through final reconciliation instead.");

      await tx.administrativePayment.updateMany({
        where: { dueItemId: id, paymentStatus: "NOT_PAID" },
        data: { approvalStatus: "CANCELLED" },
      });
      const reason = cleanOptionalString(parsed.data.notes);
      const record = await tx.obligationDueItem.update({
        where: { id },
        data: {
          status: "CANCELLED",
          completedDate: null,
          disputeFlag: false,
          notes: reason ?? dueItem.notes,
        },
      });
      await audit(session.userId, "corporate.due_item.cancelled", id, {
        dueItemId: id,
        obligationId: record.obligationId,
        unrecordedPaymentRequestsCancelled: dueItem.payments.filter((payment) => payment.paymentStatus === "NOT_PAID").length,
      }, tx);
      return record;
    });
    return NextResponse.json({ dueItem: { id: updated.id, status: updated.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel due item";
    return NextResponse.json({ error: message }, { status: message === "Due item not found" ? 404 : 409 });
  }
}

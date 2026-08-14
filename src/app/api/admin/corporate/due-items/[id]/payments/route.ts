import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString, createPaymentRequestSchema } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = createPaymentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment request" }, { status: 400 });
  }

  const { id: dueItemId } = await context.params;
  const initial = await db.obligationDueItem.findUnique({ where: { id: dueItemId }, select: { obligationId: true } });
  if (!initial) return NextResponse.json({ error: "Due item not found" }, { status: 404 });

  try {
    const payment = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${initial.obligationId} FOR UPDATE`;
      const closure = await tx.administrativeClosure.findUnique({ where: { obligationId: initial.obligationId }, select: { status: true } });
      if (closure?.status === "CLOSED") throw new Error("Closed administrative files are read-only");
      await tx.$queryRaw`SELECT "id" FROM "ObligationDueItem" WHERE "id" = ${dueItemId} FOR UPDATE`;
      const dueItem = await tx.obligationDueItem.findUnique({
        where: { id: dueItemId },
        include: { payments: { select: { paymentStatus: true, paidAmount: true } } },
      });
      if (!dueItem) throw new Error("Due item not found");
      if (dueItem.status !== "OPEN") throw new Error("Payment requests require an open due item");

      const target = dueItem.invoiceAmount ?? dueItem.expectedAmount;
      if (target) {
        const paid = dueItem.payments.reduce((sum, item) => {
          if (item.paymentStatus === "PAID" || item.paymentStatus === "PARTIALLY_PAID") {
            return sum + Number(item.paidAmount ?? 0);
          }
          return sum;
        }, 0);
        const outstanding = Math.max(0, Number(target) - paid);
        if (parsed.data.requestedAmount > outstanding + 0.000001) {
          throw new Error(`Requested amount exceeds the current outstanding amount (${outstanding.toFixed(2)})`);
        }
      }

      const customFields = await validateAdministrativeCustomFields("PAYMENT", parsed.data.customFields, tx);
      const created = await tx.administrativePayment.create({
        data: {
          dueItemId,
          requestedById: session.userId,
          requestedAmount: parsed.data.requestedAmount,
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });
      await audit(session.userId, "corporate.payment.requested", created.id, {
        dueItemId,
        paymentId: created.id,
      }, tx);
      return created;
    });

    return NextResponse.json({ payment: { id: payment.id, approvalStatus: payment.approvalStatus } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not request payment";
    return NextResponse.json({ error: message }, { status: message === "Due item not found" ? 404 : 400 });
  }
}

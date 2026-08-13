import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { updateDueItemSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const dueItemActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CANCEL"),
    notes: z.string().trim().max(10_000).optional().nullable(),
  }),
  z.object({
    action: z.literal("RESOLVE_BALANCE"),
    notes: z.string().trim().min(1).max(10_000),
  }),
]);

function malaysiaDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

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
        include: { payments: { select: { id: true, paymentStatus: true, approvalStatus: true, reconciledAt: true } } },
      });
      if (!dueItem) throw new Error("Due item not found");
      if (dueItem.status === "CANCELLED") throw new Error("Due item is already cancelled");

      const recordedPayments = dueItem.payments.filter((payment) => payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID");

      if (parsed.data.action === "CANCEL") {
        if (recordedPayments.length > 0) {
          throw new Error("A due item with recorded payment history cannot be cancelled. Reconcile the payment and resolve any remaining balance through final reconciliation instead.");
        }
        await tx.administrativePayment.updateMany({
          where: { dueItemId: id, paymentStatus: "NOT_PAID", approvalStatus: { in: ["PENDING", "APPROVED"] } },
          data: { approvalStatus: "CANCELLED" },
        });
        const reason = cleanOptionalString(parsed.data.notes);
        const record = await tx.obligationDueItem.update({
          where: { id },
          data: { status: "CANCELLED", completedDate: null, disputeFlag: false, notes: reason ?? dueItem.notes },
        });
        await audit(session.userId, "corporate.due_item.cancelled", id, {
          dueItemId: id,
          obligationId: record.obligationId,
          unrecordedPaymentRequestsCancelled: dueItem.payments.filter((payment) => payment.paymentStatus === "NOT_PAID" && (payment.approvalStatus === "PENDING" || payment.approvalStatus === "APPROVED")).length,
        }, tx);
        return record;
      }

      if (dueItem.status !== "OPEN") throw new Error("Only an open due item can have its residual balance resolved");
      if (recordedPayments.length === 0) throw new Error("No recorded payment exists. Cancel or waive the due item instead of resolving a residual balance");
      if (recordedPayments.some((payment) => !payment.reconciledAt)) {
        throw new Error("Reconcile every recorded payment before resolving the remaining balance");
      }
      const closure = await tx.administrativeClosure.findUnique({ where: { obligationId: dueItem.obligationId }, select: { status: true } });
      if (!closure) throw new Error("Start termination and final reconciliation before resolving the remaining balance");
      if (closure.status === "CLOSED") throw new Error("Closed files cannot be changed");

      await tx.administrativePayment.updateMany({
        where: { dueItemId: id, paymentStatus: "NOT_PAID", approvalStatus: { in: ["PENDING", "APPROVED"] } },
        data: { approvalStatus: "CANCELLED" },
      });
      const record = await tx.obligationDueItem.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedDate: parseDateOnly(malaysiaDateOnly()),
          disputeFlag: false,
          notes: parsed.data.notes,
        },
      });
      await audit(session.userId, "corporate.due_item.residual_resolved", id, {
        dueItemId: id,
        obligationId: record.obligationId,
        recordedPayments: recordedPayments.length,
        unrecordedPaymentRequestsCancelled: dueItem.payments.filter((payment) => payment.paymentStatus === "NOT_PAID" && (payment.approvalStatus === "PENDING" || payment.approvalStatus === "APPROVED")).length,
        reason: parsed.data.notes,
      }, tx);
      return record;
    });
    return NextResponse.json({ dueItem: { id: updated.id, status: updated.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update due item";
    return NextResponse.json({ error: message }, { status: message === "Due item not found" ? 404 : 409 });
  }
}

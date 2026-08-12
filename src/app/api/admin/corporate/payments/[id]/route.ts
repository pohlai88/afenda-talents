import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import {
  cleanOptionalString,
  parseDateOnly,
  paymentActionSchema,
} from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

type Tx = Prisma.TransactionClient;

async function syncDueItemCompletion(tx: Tx, dueItemId: string) {
  const dueItem = await tx.obligationDueItem.findUnique({
    where: { id: dueItemId },
    include: { payments: { select: { paymentStatus: true, paidAmount: true } } },
  });
  if (!dueItem || dueItem.status === "CANCELLED") return;

  const target = dueItem.invoiceAmount ?? dueItem.expectedAmount;
  if (!target) return;

  const paid = dueItem.payments.reduce((sum, item) => {
    if (item.paymentStatus === "PAID" || item.paymentStatus === "PARTIALLY_PAID") {
      return sum + Number(item.paidAmount ?? 0);
    }
    return sum;
  }, 0);
  const complete = paid + 0.000001 >= Number(target);

  await tx.obligationDueItem.update({
    where: { id: dueItemId },
    data: {
      status: complete ? "COMPLETED" : "OPEN",
      completedDate: complete ? parseDateOnly(new Date().toISOString().slice(0, 10)) : null,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = paymentActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment action" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const result = await db.$transaction(async (tx) => {
      const paymentBeforeLock = await tx.administrativePayment.findUnique({
        where: { id },
        select: { id: true, dueItemId: true },
      });
      if (!paymentBeforeLock) throw new Error("Payment not found");

      await tx.$queryRaw`SELECT "id" FROM "ObligationDueItem" WHERE "id" = ${paymentBeforeLock.dueItemId} FOR UPDATE`;
      const payment = await tx.administrativePayment.findUnique({
        where: { id },
        include: {
          dueItem: {
            include: {
              payments: {
                select: {
                  id: true,
                  approvalStatus: true,
                  approvedAmount: true,
                  paymentStatus: true,
                  paidAmount: true,
                },
              },
            },
          },
        },
      });
      if (!payment) throw new Error("Payment not found");

      const action = parsed.data.action;
      if (action === "APPROVE") {
        if (payment.approvalStatus !== "PENDING") throw new Error("Only pending requests can be approved");
        if (parsed.data.approvedAmount > Number(payment.requestedAmount) + 0.000001) {
          throw new Error("Approved amount cannot exceed the requested amount");
        }

        const target = payment.dueItem.invoiceAmount ?? payment.dueItem.expectedAmount;
        if (target) {
          let paid = 0;
          let reserved = 0;
          for (const other of payment.dueItem.payments) {
            if (other.id === payment.id) continue;
            if (other.paymentStatus === "PAID" || other.paymentStatus === "PARTIALLY_PAID") {
              paid += Number(other.paidAmount ?? 0);
            } else if (other.approvalStatus === "APPROVED" && other.paymentStatus === "NOT_PAID") {
              reserved += Number(other.approvedAmount ?? 0);
            }
          }
          const available = Math.max(0, Number(target) - paid - reserved);
          if (parsed.data.approvedAmount > available + 0.000001) {
            throw new Error(`Approved amount exceeds the uncommitted balance (${available.toFixed(2)})`);
          }
        }

        const updated = await tx.administrativePayment.update({
          where: { id },
          data: {
            approvalStatus: "APPROVED",
            approvedAmount: parsed.data.approvedAmount,
            approvedById: session.userId,
            approvalDate: new Date(),
          },
        });
        await audit(session.userId, "corporate.payment.approved", id, { paymentId: id, dueItemId: payment.dueItemId }, tx);
        return updated;
      }

      if (action === "REJECT") {
        if (payment.approvalStatus !== "PENDING") throw new Error("Only pending requests can be rejected");
        const updated = await tx.administrativePayment.update({
          where: { id },
          data: {
            approvalStatus: "REJECTED",
            approvedById: session.userId,
            approvalDate: new Date(),
            notes: cleanOptionalString(parsed.data.notes) ?? payment.notes,
          },
        });
        await audit(session.userId, "corporate.payment.rejected", id, { paymentId: id, dueItemId: payment.dueItemId }, tx);
        return updated;
      }

      if (action === "RECORD_PAYMENT") {
        if (payment.approvalStatus !== "APPROVED" || !payment.approvedAmount) {
          throw new Error("Payment must be approved before it can be recorded");
        }
        if (payment.paymentStatus !== "NOT_PAID") throw new Error("This payment has already been recorded or voided");
        if (parsed.data.paidAmount > Number(payment.approvedAmount) + 0.000001) {
          throw new Error("Paid amount cannot exceed the approved amount");
        }

        const target = payment.dueItem.invoiceAmount ?? payment.dueItem.expectedAmount;
        if (target) {
          const paidElsewhere = payment.dueItem.payments.reduce((sum, other) => {
            if (other.id !== payment.id && (other.paymentStatus === "PAID" || other.paymentStatus === "PARTIALLY_PAID")) {
              return sum + Number(other.paidAmount ?? 0);
            }
            return sum;
          }, 0);
          const remaining = Math.max(0, Number(target) - paidElsewhere);
          if (parsed.data.paidAmount > remaining + 0.000001) {
            throw new Error(`Paid amount exceeds the current outstanding balance (${remaining.toFixed(2)})`);
          }
        }

        const paidInFull = parsed.data.paidAmount + 0.000001 >= Number(payment.approvedAmount);
        const updated = await tx.administrativePayment.update({
          where: { id },
          data: {
            paymentStatus: paidInFull ? "PAID" : "PARTIALLY_PAID",
            paidAmount: parsed.data.paidAmount,
            paymentDate: parseDateOnly(parsed.data.paymentDate),
            paymentMethod: parsed.data.paymentMethod,
            paymentReference: cleanOptionalString(parsed.data.paymentReference),
            paymentProofUrl: cleanOptionalString(parsed.data.paymentProofUrl),
          },
        });
        await syncDueItemCompletion(tx, payment.dueItemId);
        await audit(session.userId, "corporate.payment.recorded", id, { paymentId: id, dueItemId: payment.dueItemId }, tx);
        return updated;
      }

      if (action === "RECONCILE") {
        if (payment.paymentStatus !== "PAID" && payment.paymentStatus !== "PARTIALLY_PAID") {
          throw new Error("Only recorded payments can be reconciled");
        }
        if (payment.reconciledAt) throw new Error("Payment is already reconciled");
        const updated = await tx.administrativePayment.update({
          where: { id },
          data: { reconciledAt: new Date(), reconciledById: session.userId },
        });
        await audit(session.userId, "corporate.payment.reconciled", id, { paymentId: id, dueItemId: payment.dueItemId }, tx);
        return updated;
      }

      if (payment.paymentStatus !== "PAID" && payment.paymentStatus !== "PARTIALLY_PAID") {
        throw new Error("Only recorded payments can be voided");
      }
      if (payment.reconciledAt) throw new Error("Reconciled payments cannot be voided; use a future reversal workflow instead");
      const updated = await tx.administrativePayment.update({
        where: { id },
        data: {
          paymentStatus: "VOIDED",
          notes: cleanOptionalString(parsed.data.notes) ?? payment.notes,
        },
      });
      await syncDueItemCompletion(tx, payment.dueItemId);
      await audit(session.userId, "corporate.payment.voided", id, { paymentId: id, dueItemId: payment.dueItemId }, tx);
      return updated;
    });

    return NextResponse.json({ payment: { id: result.id, approvalStatus: result.approvalStatus, paymentStatus: result.paymentStatus } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update payment";
    return NextResponse.json({ error: message }, { status: message === "Payment not found" ? 404 : 409 });
  }
}

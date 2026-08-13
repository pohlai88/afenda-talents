import { NextResponse } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, defaultPeriodLabel, parseDateOnly } from "@/lib/corporate-admin/domain";
import { historicalPaymentRowSchema } from "@/lib/corporate-admin/settlement";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

const envelopeSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(1_000),
  source: z.enum(["MANUAL", "CSV_IMPORT"]).default("CSV_IMPORT"),
});

type Tx = Prisma.TransactionClient;

async function lockMutableObligation(tx: Tx, obligationId: string) {
  await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${obligationId} FOR UPDATE`;
  const closure = await tx.administrativeClosure.findUnique({
    where: { obligationId },
    select: { status: true },
  });
  if (closure?.status === "CLOSED") {
    throw new Error("Closed administrative files cannot receive additional historical payments");
  }
}

async function syncDueItemCompletion(tx: Tx, dueItemId: string, paymentDate: Date) {
  const dueItem = await tx.obligationDueItem.findUnique({
    where: { id: dueItemId },
    include: { payments: { select: { paymentStatus: true, paidAmount: true } } },
  });
  if (!dueItem || dueItem.status === "CANCELLED") return;
  const target = dueItem.invoiceAmount ?? dueItem.expectedAmount;
  if (target == null) return;
  const paid = dueItem.payments.reduce((sum, payment) => {
    if (payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID") {
      return sum + Number(payment.paidAmount ?? 0);
    }
    return sum;
  }, 0);
  const complete = paid + 0.000001 >= Number(target);
  await tx.obligationDueItem.update({
    where: { id: dueItemId },
    data: {
      status: complete ? "COMPLETED" : "OPEN",
      completedDate: complete ? paymentDate : null,
    },
  });
}

async function resolveDueItem(tx: Tx, row: z.infer<typeof historicalPaymentRowSchema>) {
  if (row.dueItemId) {
    const initial = await tx.obligationDueItem.findUnique({
      where: { id: row.dueItemId },
      select: { obligationId: true },
    });
    if (!initial) throw new Error(`Due item ${row.dueItemId} was not found`);
    await lockMutableObligation(tx, initial.obligationId);
    const dueItem = await tx.obligationDueItem.findUnique({ where: { id: row.dueItemId } });
    if (!dueItem) throw new Error(`Due item ${row.dueItemId} was not found`);
    if (dueItem.status === "CANCELLED") throw new Error("Cancelled due items cannot receive historical payments");
    if (row.currency && row.currency !== dueItem.currency.toUpperCase()) {
      throw new Error(`Imported currency ${row.currency} does not match due-item currency ${dueItem.currency.toUpperCase()}`);
    }
    return dueItem;
  }

  const obligationCode = row.obligationCode!.toUpperCase();
  const lineCode = row.lineCode!.toUpperCase();
  const obligation = await tx.administrativeObligation.findUnique({
    where: { code: obligationCode },
    select: { id: true },
  });
  if (!obligation) throw new Error(`Obligation ${obligationCode} was not found`);
  await lockMutableObligation(tx, obligation.id);

  const line = await tx.administrativeObligationLine.findFirst({
    where: { obligationId: obligation.id, code: lineCode },
    select: { id: true, currency: true, invoiceRequired: true },
  });
  if (!line) throw new Error(`Line ${lineCode} was not found on obligation ${obligationCode}`);
  if (row.currency && row.currency !== line.currency.toUpperCase()) {
    throw new Error(`Imported currency ${row.currency} does not match line currency ${line.currency.toUpperCase()}`);
  }

  const dueDate = parseDateOnly(row.dueDate!);
  const existing = await tx.obligationDueItem.findUnique({
    where: { lineId_dueDate: { lineId: line.id, dueDate } },
  });
  if (existing) {
    if (existing.status === "CANCELLED") throw new Error("Cancelled due items cannot receive historical payments");
    if (row.currency && row.currency !== existing.currency.toUpperCase()) {
      throw new Error(`Imported currency ${row.currency} does not match due-item currency ${existing.currency.toUpperCase()}`);
    }
    return existing;
  }

  return tx.obligationDueItem.create({
    data: {
      obligationId: obligation.id,
      lineId: line.id,
      periodLabel: cleanOptionalString(row.periodLabel) ?? defaultPeriodLabel(row.dueDate!),
      dueDate,
      expectedAmount: row.expectedAmount ?? row.paidAmount,
      currency: line.currency,
      invoiceRequired: line.invoiceRequired,
      notes: "Created from historical payment import",
    },
  });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const envelope = envelopeSchema.safeParse(await request.json().catch(() => null));
  if (!envelope.success) {
    return NextResponse.json({ error: envelope.error.issues[0]?.message ?? "Invalid historical payment import" }, { status: 400 });
  }

  const results: Array<{ rowNumber: number; status: "IMPORTED" | "DUPLICATE" | "ERROR"; paymentId?: string; dueItemId?: string; error?: string }> = [];

  for (let index = 0; index < envelope.data.rows.length; index += 1) {
    const rowNumber = index + 1;
    const parsed = historicalPaymentRowSchema.safeParse(envelope.data.rows[index]);
    if (!parsed.success) {
      results.push({ rowNumber, status: "ERROR", error: parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; ") });
      continue;
    }

    try {
      const result = await db.$transaction(async (tx) => {
        const dueItem = await resolveDueItem(tx, parsed.data);
        await tx.$queryRaw`SELECT "id" FROM "ObligationDueItem" WHERE "id" = ${dueItem.id} FOR UPDATE`;

        const paymentDate = parseDateOnly(parsed.data.paymentDate);
        const reference = cleanOptionalString(parsed.data.paymentReference);
        const duplicate = await tx.administrativePayment.findFirst({
          where: {
            dueItemId: dueItem.id,
            paymentDate,
            paidAmount: parsed.data.paidAmount,
            paymentReference: reference,
            paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
          },
          select: { id: true },
        });
        if (duplicate) return { status: "DUPLICATE" as const, paymentId: duplicate.id, dueItemId: dueItem.id };

        const payment = await tx.administrativePayment.create({
          data: {
            dueItemId: dueItem.id,
            requestDate: paymentDate,
            requestedById: session.userId,
            requestedAmount: parsed.data.paidAmount,
            approvalStatus: "APPROVED",
            approvedAmount: parsed.data.paidAmount,
            approvalDate: null,
            approvedById: null,
            paymentStatus: "PAID",
            paymentDate,
            paidAmount: parsed.data.paidAmount,
            paymentMethod: parsed.data.paymentMethod,
            paymentReference: reference,
            paymentProofUrl: cleanOptionalString(parsed.data.paymentProofUrl),
            reconciledAt: parsed.data.reconciled ? new Date() : null,
            reconciledById: parsed.data.reconciled ? session.userId : null,
            notes: cleanOptionalString(parsed.data.notes),
          },
        });
        await tx.administrativeHistoricalPayment.create({
          data: {
            paymentId: payment.id,
            origin: envelope.data.source === "MANUAL" ? "HISTORICAL_MANUAL" : "HISTORICAL_IMPORT",
            approvalRequired: false,
          },
        });
        await syncDueItemCompletion(tx, dueItem.id, paymentDate);
        await audit(session.userId, "corporate.payment.history_recorded", payment.id, {
          paymentId: payment.id,
          dueItemId: dueItem.id,
          source: envelope.data.source.toLowerCase(),
          approvalRequired: false,
          reconciled: parsed.data.reconciled,
        }, tx);
        return { status: "IMPORTED" as const, paymentId: payment.id, dueItemId: dueItem.id };
      });
      results.push({ rowNumber, ...result });
    } catch (error) {
      results.push({ rowNumber, status: "ERROR", error: error instanceof Error ? error.message : "Could not record historical payment" });
    }
  }

  const summary = {
    imported: results.filter((row) => row.status === "IMPORTED").length,
    duplicate: results.filter((row) => row.status === "DUPLICATE").length,
    error: results.filter((row) => row.status === "ERROR").length,
  };
  return NextResponse.json({ summary, rows: results }, { status: summary.imported > 0 || summary.duplicate > 0 ? 200 : 400 });
}

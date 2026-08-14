import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import {
  cleanOptionalString,
  defaultPeriodLabel,
  formatDateOnly,
  nextOccurrence,
  parseDateOnly,
} from "@/lib/corporate-admin/domain";
import { createDueItemWithLineSchema, duplicateDueItemMessage } from "@/lib/corporate-admin/obligation-lines";
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

  const parsed = createDueItemWithLineSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid due item" }, { status: 400 });
  }

  const { id: obligationId } = await context.params;

  // Decided inside the transaction, reported by the catch below.
  let attemptedLabel = "";

  try {
    const dueItem = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${obligationId} FOR UPDATE`;
      const obligation = await tx.administrativeObligation.findUnique({ where: { id: obligationId } });
      if (!obligation) throw new Error("Obligation not found");
      if (obligation.status !== "ACTIVE") throw new Error("Only active obligations can create due items");

      const closure = await tx.administrativeClosure.findUnique({
        where: { obligationId },
        select: { status: true, effectiveDate: true },
      });
      if (closure?.status === "CLOSED") throw new Error("Closed administrative files are read-only");
      const terminationDate = closure?.effectiveDate ? formatDateOnly(closure.effectiveDate) : null;

      const line = parsed.data.lineId
        ? await tx.administrativeObligationLine.findFirst({ where: { id: parsed.data.lineId, obligationId } })
        : await tx.administrativeObligationLine.findFirst({ where: { obligationId, code: "GENERAL" } });
      if (!line) throw new Error("Obligation line not found");
      if (!line.isActive) throw new Error("Inactive obligation lines cannot create due items");
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligationLine" WHERE "id" = ${line.id} FOR UPDATE`;

      let dueDateText: string;
      if (parsed.data.mode === "NEXT") {
        if (!line.recurring || !line.nextDueDate || !line.recurrenceInterval || !line.recurrenceUnit) {
          throw new Error("This obligation line has no next recurring due item to generate");
        }
        dueDateText = formatDateOnly(line.nextDueDate);
      } else {
        if (!parsed.data.dueDate) throw new Error("Manual due items require a due date");
        dueDateText = parsed.data.dueDate;
      }

      if (terminationDate && dueDateText > terminationDate) {
        throw new Error(`Due date falls after the termination effective date (${terminationDate})`);
      }

      const customFields = await validateAdministrativeCustomFields("DUE_ITEM", parsed.data.customFields, tx);
      attemptedLabel = parsed.data.periodLabel?.trim() || defaultPeriodLabel(dueDateText);
      const created = await tx.obligationDueItem.create({
        data: {
          obligationId,
          lineId: line.id,
          periodLabel: attemptedLabel,
          dueDate: parseDateOnly(dueDateText),
          expectedAmount: parsed.data.expectedAmount ?? line.expectedAmount,
          invoiceAmount: parsed.data.invoiceAmount ?? null,
          currency: parsed.data.currency ?? line.currency,
          invoiceRequired: parsed.data.invoiceRequired ?? line.invoiceRequired,
          invoiceNumber: cleanOptionalString(parsed.data.invoiceNumber),
          invoiceFileUrl: cleanOptionalString(parsed.data.invoiceFileUrl),
          disputeFlag: parsed.data.disputeFlag ?? false,
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });

      if (parsed.data.mode === "NEXT" && line.recurrenceInterval && line.recurrenceUnit) {
        const candidateNext = nextOccurrence(dueDateText, line.recurrenceInterval, line.recurrenceUnit);
        const beyondLineEnd = line.endDate && candidateNext > formatDateOnly(line.endDate);
        // The contractual line schedule remains reversible if a termination date is corrected.
        // Termination is enforced above, rather than destructively nulling the line pointer.
        const nextDueDate = beyondLineEnd ? null : parseDateOnly(candidateNext);
        await tx.administrativeObligationLine.update({ where: { id: line.id }, data: { nextDueDate } });

        // Keep the legacy obligation pointer synchronized for GENERAL, but hide a candidate
        // that sits beyond the current termination boundary.
        if (line.code === "GENERAL") {
          const visibleNextDue = terminationDate && candidateNext > terminationDate ? null : nextDueDate;
          await tx.administrativeObligation.update({ where: { id: obligationId }, data: { nextDueDate: visibleNextDue } });
        }
      }

      await audit(session.userId, "corporate.due_item.created", created.id, {
        obligationId,
        dueItemId: created.id,
        lineId: line.id,
      }, tx);
      return created;
    });

    return NextResponse.json({ dueItem: { id: dueItem.id, dueDate: formatDateOnly(dueItem.dueDate) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create due item";
    const duplicate = message.includes("Unique constraint") || message.includes("unique constraint");
    const missing = message === "Obligation not found" || message === "Obligation line not found";
    return NextResponse.json(
      { error: duplicate ? duplicateDueItemMessage(attemptedLabel) : message },
      { status: missing ? 404 : duplicate ? 409 : 400 },
    );
  }
}

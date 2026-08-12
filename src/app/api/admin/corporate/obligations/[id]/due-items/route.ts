import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import {
  cleanOptionalString,
  createDueItemSchema,
  defaultPeriodLabel,
  formatDateOnly,
  nextOccurrence,
  parseDateOnly,
} from "@/lib/corporate-admin/domain";
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

  const parsed = createDueItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid due item" }, { status: 400 });
  }

  const { id: obligationId } = await context.params;

  try {
    const dueItem = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${obligationId} FOR UPDATE`;
      const obligation = await tx.administrativeObligation.findUnique({ where: { id: obligationId } });
      if (!obligation) throw new Error("Obligation not found");
      if (obligation.status !== "ACTIVE") throw new Error("Only active obligations can create due items");

      let dueDateText: string;
      if (parsed.data.mode === "NEXT") {
        if (!obligation.recurring || !obligation.nextDueDate || !obligation.recurrenceInterval || !obligation.recurrenceUnit) {
          throw new Error("This obligation has no next recurring due item to generate");
        }
        dueDateText = formatDateOnly(obligation.nextDueDate);
      } else {
        if (!parsed.data.dueDate) throw new Error("Manual due items require a due date");
        dueDateText = parsed.data.dueDate;
      }

      const customFields = await validateAdministrativeCustomFields("DUE_ITEM", parsed.data.customFields, tx);
      const created = await tx.obligationDueItem.create({
        data: {
          obligationId,
          periodLabel: parsed.data.periodLabel?.trim() || defaultPeriodLabel(dueDateText),
          dueDate: parseDateOnly(dueDateText),
          expectedAmount: parsed.data.expectedAmount ?? obligation.expectedAmount,
          invoiceAmount: parsed.data.invoiceAmount ?? null,
          currency: parsed.data.currency ?? obligation.currency,
          invoiceRequired: parsed.data.invoiceRequired ?? false,
          invoiceNumber: cleanOptionalString(parsed.data.invoiceNumber),
          invoiceFileUrl: cleanOptionalString(parsed.data.invoiceFileUrl),
          disputeFlag: parsed.data.disputeFlag ?? false,
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });

      if (parsed.data.mode === "NEXT" && obligation.recurrenceInterval && obligation.recurrenceUnit) {
        const candidateNext = nextOccurrence(dueDateText, obligation.recurrenceInterval, obligation.recurrenceUnit);
        const beyondEnd = obligation.endDate && candidateNext > formatDateOnly(obligation.endDate);
        await tx.administrativeObligation.update({
          where: { id: obligationId },
          data: { nextDueDate: beyondEnd ? null : parseDateOnly(candidateNext) },
        });
      }

      await audit(session.userId, "corporate.due_item.created", created.id, {
        obligationId,
        dueItemId: created.id,
      }, tx);
      return created;
    });

    return NextResponse.json({ dueItem: { id: dueItem.id, dueDate: formatDateOnly(dueItem.dueDate) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create due item";
    const duplicate = message.includes("Unique constraint") || message.includes("unique constraint");
    const missing = message === "Obligation not found";
    return NextResponse.json(
      { error: duplicate ? "A due item already exists for that obligation and date" : message },
      { status: missing ? 404 : duplicate ? 409 : 400 },
    );
  }
}

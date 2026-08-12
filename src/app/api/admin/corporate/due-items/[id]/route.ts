import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { updateDueItemSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

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

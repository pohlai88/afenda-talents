import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { patchObligationLineSchema } from "@/lib/corporate-admin/obligation-lines";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; lineId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchObligationLineSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid line update" }, { status: 400 });
  const { id: obligationId, lineId } = await context.params;

  try {
    const updated = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${obligationId} FOR UPDATE`;
      const closure = await tx.administrativeClosure.findUnique({ where: { obligationId }, select: { status: true } });
      if (closure) throw new Error(closure.status === "CLOSED" ? "Closed administrative files are read-only" : "Agreement lines are frozen once settlement and closure has started");

      const line = await tx.administrativeObligationLine.findFirst({ where: { id: lineId, obligationId } });
      if (!line) throw new Error("Obligation line not found");
      if (parsed.data.action === "SET_ACTIVE" && line.code === "GENERAL" && parsed.data.isActive === false) {
        throw new Error("The GENERAL compatibility line cannot be deactivated");
      }

      const record = await tx.administrativeObligationLine.update({
        where: { id: lineId },
        data: parsed.data.action === "SET_ACTIVE"
          ? { isActive: parsed.data.isActive }
          : {
              name: parsed.data.name ?? undefined,
              lineType: parsed.data.lineType ?? undefined,
              expectedAmount: parsed.data.expectedAmount === undefined ? undefined : parsed.data.expectedAmount,
              currency: parsed.data.currency ?? undefined,
              recurring: parsed.data.recurring ?? undefined,
              recurrenceInterval: parsed.data.recurrenceInterval === undefined ? undefined : parsed.data.recurrenceInterval,
              recurrenceUnit: parsed.data.recurrenceUnit === undefined ? undefined : parsed.data.recurrenceUnit,
              firstDueDate: parsed.data.firstDueDate === undefined ? undefined : parsed.data.firstDueDate ? parseDateOnly(parsed.data.firstDueDate) : null,
              nextDueDate: parsed.data.nextDueDate === undefined ? undefined : parsed.data.nextDueDate ? parseDateOnly(parsed.data.nextDueDate) : null,
              invoiceRequired: parsed.data.invoiceRequired ?? undefined,
              paymentTermsDays: parsed.data.paymentTermsDays === undefined ? undefined : parsed.data.paymentTermsDays,
              startDate: parsed.data.startDate === undefined ? undefined : parsed.data.startDate ? parseDateOnly(parsed.data.startDate) : null,
              endDate: parsed.data.endDate === undefined ? undefined : parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : null,
              notes: parsed.data.notes === undefined ? undefined : cleanOptionalString(parsed.data.notes),
            },
      });
      await audit(session.userId, "corporate.obligation.line.updated", record.id, {
        obligationId,
        obligationLineId: record.id,
        action: parsed.data.action,
      }, tx);
      return record;
    });
    return NextResponse.json({ line: { id: updated.id, isActive: updated.isActive } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update obligation line";
    return NextResponse.json({ error: message }, { status: message === "Obligation line not found" ? 404 : 400 });
  }
}

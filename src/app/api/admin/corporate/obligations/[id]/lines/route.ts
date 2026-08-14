import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { createObligationLineSchema } from "@/lib/corporate-admin/obligation-lines";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = createObligationLineSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid obligation line" }, { status: 400 });
  }

  const { id: obligationId } = await context.params;

  try {
    const line = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${obligationId} FOR UPDATE`;
      const obligation = await tx.administrativeObligation.findUnique({ where: { id: obligationId }, select: { id: true, status: true } });
      if (!obligation) throw new Error("Obligation not found");
      const closure = await tx.administrativeClosure.findUnique({ where: { obligationId }, select: { status: true } });
      if (closure) throw new Error(closure.status === "CLOSED" ? "Closed administrative files are read-only" : "Agreement lines are frozen once settlement and closure has started");
      if (obligation.status === "ENDED" || obligation.status === "CANCELLED") throw new Error("Closed obligations cannot add new lines");

      const firstDueDate = parsed.data.firstDueDate ? parseDateOnly(parsed.data.firstDueDate) : null;
      const nextDueDate = parsed.data.nextDueDate ? parseDateOnly(parsed.data.nextDueDate) : firstDueDate;
      const created = await tx.administrativeObligationLine.create({
        data: {
          obligationId,
          code: parsed.data.code.toUpperCase(),
          name: parsed.data.name,
          lineType: parsed.data.lineType.toUpperCase(),
          expectedAmount: parsed.data.expectedAmount ?? null,
          currency: parsed.data.currency,
          recurring: parsed.data.recurring,
          recurrenceInterval: parsed.data.recurring ? parsed.data.recurrenceInterval : null,
          recurrenceUnit: parsed.data.recurring ? parsed.data.recurrenceUnit : null,
          firstDueDate,
          nextDueDate,
          invoiceRequired: parsed.data.invoiceRequired,
          paymentTermsDays: parsed.data.paymentTermsDays ?? null,
          startDate: parsed.data.startDate ? parseDateOnly(parsed.data.startDate) : null,
          endDate: parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : null,
          notes: cleanOptionalString(parsed.data.notes),
        },
      });

      await audit(session.userId, "corporate.obligation.updated", obligationId, {
        obligationId,
        lineId: created.id,
        change: "line_created",
      }, tx);
      return created;
    });

    return NextResponse.json({ line: { id: line.id, code: line.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create obligation line";
    const conflict = message.includes("Unique constraint") || message.includes("unique constraint");
    const missing = message === "Obligation not found";
    return NextResponse.json({ error: conflict ? "Line code already exists on this obligation" : message }, { status: missing ? 404 : conflict ? 409 : 400 });
  }
}

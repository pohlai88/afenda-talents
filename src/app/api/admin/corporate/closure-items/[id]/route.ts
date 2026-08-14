import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { reconciliationItemPatchSchema } from "@/lib/corporate-admin/settlement";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = reconciliationItemPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reconciliation update" }, { status: 400 });
  const { id } = await context.params;

  const initial = await db.administrativeReconciliationItem.findUnique({
    where: { id },
    select: { closure: { select: { obligationId: true } } },
  });
  if (!initial) return NextResponse.json({ error: "Reconciliation item not found" }, { status: 404 });

  try {
    const item = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdministrativeObligation" WHERE "id" = ${initial.closure.obligationId} FOR UPDATE`;
      const existing = await tx.administrativeReconciliationItem.findUnique({ where: { id }, include: { closure: { select: { obligationId: true, status: true } } } });
      if (!existing) throw new Error("Reconciliation item not found");
      if (existing.closure.status === "CLOSED") throw new Error("Closed files cannot be changed");

      const updated = await tx.administrativeReconciliationItem.update({
        where: { id },
        data: {
          actualAmount: parsed.data.actualAmount ?? null,
          status: parsed.data.status,
          evidenceUrl: cleanOptionalString(parsed.data.evidenceUrl),
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.reconciliation_item.updated", id, {
        itemId: id,
        closureId: existing.closureId,
        obligationId: existing.closure.obligationId,
        status: updated.status,
      }, tx);
      return updated;
    });
    return NextResponse.json({ item: { id: item.id, status: item.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update reconciliation item";
    return NextResponse.json({ error: message }, { status: message === "Reconciliation item not found" ? 404 : 409 });
  }
}

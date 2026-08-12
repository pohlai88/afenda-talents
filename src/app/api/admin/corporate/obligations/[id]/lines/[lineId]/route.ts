import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
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
    const line = await db.administrativeObligationLine.findFirst({ where: { id: lineId, obligationId } });
    if (!line) return NextResponse.json({ error: "Obligation line not found" }, { status: 404 });

    if (parsed.data.action === "SET_ACTIVE" && line.code === "GENERAL" && parsed.data.isActive === false) {
      return NextResponse.json({ error: "The GENERAL compatibility line cannot be deactivated" }, { status: 400 });
    }

    const updated = await db.administrativeObligationLine.update({
      where: { id: lineId },
      data: parsed.data.action === "SET_ACTIVE"
        ? { isActive: parsed.data.isActive }
        : {
            name: parsed.data.name ?? undefined,
            lineType: parsed.data.lineType ?? undefined,
            expectedAmount: parsed.data.expectedAmount === undefined ? undefined : parsed.data.expectedAmount,
            currency: parsed.data.currency ?? undefined,
            invoiceRequired: parsed.data.invoiceRequired ?? undefined,
            paymentTermsDays: parsed.data.paymentTermsDays === undefined ? undefined : parsed.data.paymentTermsDays,
            notes: parsed.data.notes === undefined ? undefined : cleanOptionalString(parsed.data.notes),
          },
    });

    await audit(session.userId, "corporate.obligation.line.updated", updated.id, {
      obligationId,
      obligationLineId: updated.id,
      action: parsed.data.action,
    });
    return NextResponse.json({ line: { id: updated.id, isActive: updated.isActive } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update obligation line" }, { status: 400 });
  }
}

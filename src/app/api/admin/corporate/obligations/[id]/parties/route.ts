import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, createObligationPartySchema, parseDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const { id: obligationId } = await params;
  const parsed = createObligationPartySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid obligation party" }, { status: 400 });

  const [obligation, counterparty] = await Promise.all([
    db.administrativeObligation.findUnique({ where: { id: obligationId }, select: { id: true } }),
    db.administrativeCounterparty.findUnique({ where: { id: parsed.data.counterpartyId }, select: { id: true, isActive: true } }),
  ]);
  if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 });
  if (!counterparty) return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
  if (!counterparty.isActive) return NextResponse.json({ error: "Inactive counterparties cannot receive new obligation roles" }, { status: 409 });

  const party = await db.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.administrativeObligationParty.updateMany({ where: { obligationId, isPrimary: true }, data: { isPrimary: false } });
    }
    return tx.administrativeObligationParty.upsert({
      where: { obligationId_counterpartyId_roleCode: { obligationId, counterpartyId: parsed.data.counterpartyId, roleCode: parsed.data.roleCode } },
      update: {
        isPrimary: parsed.data.isPrimary,
        effectiveFrom: parsed.data.effectiveFrom ? parseDateOnly(parsed.data.effectiveFrom) : null,
        effectiveTo: parsed.data.effectiveTo ? parseDateOnly(parsed.data.effectiveTo) : null,
        notes: cleanOptionalString(parsed.data.notes),
      },
      create: {
        obligationId,
        counterpartyId: parsed.data.counterpartyId,
        roleCode: parsed.data.roleCode,
        isPrimary: parsed.data.isPrimary,
        effectiveFrom: parsed.data.effectiveFrom ? parseDateOnly(parsed.data.effectiveFrom) : null,
        effectiveTo: parsed.data.effectiveTo ? parseDateOnly(parsed.data.effectiveTo) : null,
        notes: cleanOptionalString(parsed.data.notes),
      },
    });
  });
  await audit(session.userId, "corporate.obligation.party.linked", obligationId, { counterpartyId: party.counterpartyId, roleCode: party.roleCode });
  return NextResponse.json({ party: { counterpartyId: party.counterpartyId, roleCode: party.roleCode } });
}

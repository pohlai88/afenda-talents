import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, createCounterpartyContactSchema } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const { id: counterpartyId } = await params;
  const parsed = createCounterpartyContactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid contact" }, { status: 400 });

  const counterparty = await db.administrativeCounterparty.findUnique({ where: { id: counterpartyId }, select: { id: true } });
  if (!counterparty) return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });

  const contact = await db.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.administrativeCounterpartyContact.updateMany({ where: { counterpartyId, isPrimary: true }, data: { isPrimary: false } });
    }
    return tx.administrativeCounterpartyContact.create({ data: {
      counterpartyId,
      name: parsed.data.name,
      jobTitle: cleanOptionalString(parsed.data.jobTitle),
      department: cleanOptionalString(parsed.data.department),
      email: cleanOptionalString(parsed.data.email),
      phone: cleanOptionalString(parsed.data.phone),
      mobile: cleanOptionalString(parsed.data.mobile),
      role: cleanOptionalString(parsed.data.role),
      isPrimary: parsed.data.isPrimary,
      isActive: parsed.data.isActive,
      notes: cleanOptionalString(parsed.data.notes),
    }});
  });
  await audit(session.userId, "corporate.counterparty.contact.created", contact.id, { counterpartyId });
  return NextResponse.json({ contact: { id: contact.id } });
}

import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { patchCounterpartyContactSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; contactId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchCounterpartyContactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid contact update" }, { status: 400 });

  const { id: counterpartyId, contactId } = await context.params;
  const contact = await db.administrativeCounterpartyContact.findFirst({ where: { id: contactId, counterpartyId }, select: { id: true, isPrimary: true } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  if (parsed.data.action === "SET_ACTIVE" && parsed.data.isActive === false && contact.isPrimary) {
    return NextResponse.json({ error: "Primary contact must be reassigned before deactivation" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeCounterpartyContact.update({ where: { id: contactId }, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.counterparty.contact.updated", contactId, { counterpartyId, contactId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      if (parsed.data.isPrimary === true) {
        await tx.administrativeCounterpartyContact.updateMany({
          where: { counterpartyId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.administrativeCounterpartyContact.update({
        where: { id: contactId },
        data: {
          name: parsed.data.name,
          jobTitle: parsed.data.jobTitle === undefined ? undefined : cleanOptionalString(parsed.data.jobTitle),
          department: parsed.data.department === undefined ? undefined : cleanOptionalString(parsed.data.department),
          email: parsed.data.email === undefined ? undefined : cleanOptionalString(parsed.data.email),
          phone: parsed.data.phone === undefined ? undefined : cleanOptionalString(parsed.data.phone),
          mobile: parsed.data.mobile === undefined ? undefined : cleanOptionalString(parsed.data.mobile),
          role: parsed.data.role === undefined ? undefined : cleanOptionalString(parsed.data.role),
          isPrimary: parsed.data.isPrimary === undefined ? undefined : parsed.data.isPrimary,
          notes: parsed.data.notes === undefined ? undefined : cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.counterparty.contact.updated", contactId, { counterpartyId, contactId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ contact: { id: contactId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update contact" }, { status: 400 });
  }
}

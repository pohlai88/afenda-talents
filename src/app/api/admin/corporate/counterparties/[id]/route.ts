import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { updateCounterpartySchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = updateCounterpartySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid counterparty" }, { status: 400 });
  const { id } = await context.params;
  if (!await db.administrativeCounterparty.findUnique({ where: { id }, select: { id: true } })) {
    return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
  }

  try {
    const customFields = await validateAdministrativeCustomFields("COUNTERPARTY", parsed.data.customFields);
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.administrativeCounterparty.update({
        where: { id },
        data: {
          code: cleanOptionalString(parsed.data.code) ?? undefined,
          name: parsed.data.name,
          type: parsed.data.type,
          registrationNo: cleanOptionalString(parsed.data.registrationNo),
          taxId: cleanOptionalString(parsed.data.taxId),
          contactName: cleanOptionalString(parsed.data.contactName),
          contactEmail: cleanOptionalString(parsed.data.contactEmail),
          contactPhone: cleanOptionalString(parsed.data.contactPhone),
          address: cleanOptionalString(parsed.data.address),
          countryCode: cleanOptionalString(parsed.data.countryCode),
          websiteUrl: cleanOptionalString(parsed.data.websiteUrl),
          defaultCurrency: cleanOptionalString(parsed.data.defaultCurrency)?.toUpperCase() ?? null,
          paymentTermsDays: parsed.data.paymentTermsDays ?? null,
          isActive: parsed.data.isActive,
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });
      await audit(session.userId, "corporate.counterparty.updated", id, { counterpartyId: id }, tx);
      return record;
    });
    return NextResponse.json({ counterparty: { id: updated.id, code: updated.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update counterparty";
    const conflict = /unique constraint/i.test(message);
    return NextResponse.json({ error: conflict ? "Counterparty code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}

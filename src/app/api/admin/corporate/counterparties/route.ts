import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import {
  cleanOptionalString,
  createCounterpartySchema,
  newReferenceCode,
} from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = createCounterpartySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid counterparty" }, { status: 400 });
  }

  try {
    const customFields = await validateAdministrativeCustomFields("COUNTERPARTY", parsed.data.customFields);
    const counterparty = await db.administrativeCounterparty.create({
      data: {
        code: cleanOptionalString(parsed.data.code) ?? newReferenceCode("CP"),
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

    await audit(session.userId, "corporate.counterparty.created", counterparty.id, {
      counterpartyId: counterparty.id,
    });

    return NextResponse.json({ counterparty: { id: counterparty.id, code: counterparty.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create counterparty";
    const conflict = message.includes("Unique constraint") || message.includes("unique constraint");
    return NextResponse.json({ error: conflict ? "Counterparty code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}

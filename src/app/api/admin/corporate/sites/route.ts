import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString, createSiteSchema, newReferenceCode } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site" }, { status: 400 });

  try {
    const customFields = await validateAdministrativeCustomFields("SITE", parsed.data.customFields);
    const site = await db.administrativeSite.create({ data: {
      code: cleanOptionalString(parsed.data.code) ?? newReferenceCode("SITE"),
      name: parsed.data.name,
      type: parsed.data.type,
      organization: cleanOptionalString(parsed.data.organization),
      addressLine1: cleanOptionalString(parsed.data.addressLine1),
      addressLine2: cleanOptionalString(parsed.data.addressLine2),
      city: cleanOptionalString(parsed.data.city),
      stateRegion: cleanOptionalString(parsed.data.stateRegion),
      postalCode: cleanOptionalString(parsed.data.postalCode),
      countryCode: cleanOptionalString(parsed.data.countryCode)?.toUpperCase() ?? null,
      timezone: cleanOptionalString(parsed.data.timezone),
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      isActive: parsed.data.isActive,
      notes: cleanOptionalString(parsed.data.notes),
      customFields,
    }});
    await audit(session.userId, "corporate.site.created", site.id, { siteId: site.id });
    return NextResponse.json({ site: { id: site.id, code: site.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create site";
    const conflict = message.toLowerCase().includes("unique constraint");
    return NextResponse.json({ error: conflict ? "Site code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}

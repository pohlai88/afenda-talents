import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { patchSiteSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site update" }, { status: 400 });

  const { id } = await context.params;
  const site = await db.administrativeSite.findUnique({ where: { id }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  try {
    const updated = await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        const record = await tx.administrativeSite.update({ where: { id }, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.site.updated", id, { siteId: id, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return record;
      }

      const customFields = parsed.data.customFields === undefined ? undefined : await validateAdministrativeCustomFields("SITE", parsed.data.customFields, tx);
      const record = await tx.administrativeSite.update({
        where: { id },
        data: {
          code: cleanOptionalString(parsed.data.code) ?? undefined,
          name: parsed.data.name,
          type: parsed.data.type,
          organization: parsed.data.organization === undefined ? undefined : cleanOptionalString(parsed.data.organization),
          addressLine1: parsed.data.addressLine1 === undefined ? undefined : cleanOptionalString(parsed.data.addressLine1),
          addressLine2: parsed.data.addressLine2 === undefined ? undefined : cleanOptionalString(parsed.data.addressLine2),
          city: parsed.data.city === undefined ? undefined : cleanOptionalString(parsed.data.city),
          stateRegion: parsed.data.stateRegion === undefined ? undefined : cleanOptionalString(parsed.data.stateRegion),
          postalCode: parsed.data.postalCode === undefined ? undefined : cleanOptionalString(parsed.data.postalCode),
          countryCode: parsed.data.countryCode === undefined ? undefined : (cleanOptionalString(parsed.data.countryCode)?.toUpperCase() ?? null),
          timezone: parsed.data.timezone === undefined ? undefined : cleanOptionalString(parsed.data.timezone),
          latitude: parsed.data.latitude === undefined ? undefined : parsed.data.latitude,
          longitude: parsed.data.longitude === undefined ? undefined : parsed.data.longitude,
          notes: parsed.data.notes === undefined ? undefined : cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });
      await audit(session.userId, "corporate.site.updated", id, { siteId: id, action: "UPDATE" }, tx);
      return record;
    });

    return NextResponse.json({ site: { id: updated.id, code: updated.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update site";
    const conflict = /unique constraint/i.test(message);
    return NextResponse.json({ error: conflict ? "Site code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}

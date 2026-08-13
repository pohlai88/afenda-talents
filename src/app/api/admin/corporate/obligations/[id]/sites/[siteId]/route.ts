import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { patchObligationSiteSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; siteId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchObligationSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site link update" }, { status: 400 });

  const { id: obligationId, siteId } = await context.params;
  const key = { obligationId_siteId: { obligationId, siteId } };

  const link = await db.administrativeObligationSite.findUnique({ where: key, select: { obligationId: true } });
  if (!link) return NextResponse.json({ error: "Obligation site link not found" }, { status: 404 });

  const subject = `${obligationId}:${siteId}`;

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeObligationSite.update({ where: key, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.obligation.site.updated", subject, { obligationId, siteId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      await tx.administrativeObligationSite.update({
        where: key,
        data: {
          scopeRole: cleanOptionalString(parsed.data.scopeRole),
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.obligation.site.updated", subject, { obligationId, siteId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ link: { obligationId, siteId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update obligation site link" }, { status: 400 });
  }
}

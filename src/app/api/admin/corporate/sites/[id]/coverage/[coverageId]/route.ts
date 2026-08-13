import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { patchServiceCoverageSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; coverageId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchServiceCoverageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid coverage update" }, { status: 400 });

  const { id: siteId, coverageId } = await context.params;
  const coverage = await db.administrativeServiceCoverage.findFirst({ where: { id: coverageId, siteId }, select: { id: true } });
  if (!coverage) return NextResponse.json({ error: "Service coverage not found" }, { status: 404 });

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeServiceCoverage.update({ where: { id: coverageId }, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.site.coverage.updated", coverageId, { siteId, coverageId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      await tx.administrativeServiceCoverage.update({
        where: { id: coverageId },
        data: {
          serviceCategory: parsed.data.serviceCategory,
          roleCode: cleanOptionalString(parsed.data.roleCode),
          effectiveFrom: parsed.data.effectiveFrom ? parseDateOnly(parsed.data.effectiveFrom) : null,
          effectiveTo: parsed.data.effectiveTo ? parseDateOnly(parsed.data.effectiveTo) : null,
          isPrimary: parsed.data.isPrimary,
          serviceLevel: cleanOptionalString(parsed.data.serviceLevel),
          emergencyContact: cleanOptionalString(parsed.data.emergencyContact),
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.site.coverage.updated", coverageId, { siteId, coverageId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ coverage: { id: coverageId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update service coverage" }, { status: 400 });
  }
}

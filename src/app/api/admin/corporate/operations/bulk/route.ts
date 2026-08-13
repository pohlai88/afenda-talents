import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { corporateBulkOperationSchema } from "@/lib/corporate-admin/operations-bulk";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = corporateBulkOperationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid bulk operation" }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_LINE_ACTIVE") {
        const lines = await tx.administrativeObligationLine.findMany({
          where: { id: { in: parsed.data.lineIds } },
          select: { id: true, code: true, isActive: true, obligationId: true },
        });
        if (lines.length !== parsed.data.lineIds.length) throw new Error("One or more agreement lines were not found");
        if (!parsed.data.isActive && lines.some((line) => line.code === "GENERAL")) throw new Error("The GENERAL compatibility line cannot be deactivated");

        for (const line of lines) {
          if (line.isActive === parsed.data.isActive) continue;
          await tx.administrativeObligationLine.update({ where: { id: line.id }, data: { isActive: parsed.data.isActive } });
          await audit(session.userId, "corporate.obligation.line.updated", line.id, {
            obligationId: line.obligationId,
            obligationLineId: line.id,
            action: "SET_ACTIVE",
          }, tx);
        }
        return { affected: lines.length };
      }

      const site = await tx.administrativeSite.findUnique({ where: { id: parsed.data.siteId }, select: { id: true, isActive: true } });
      if (!site) throw new Error("Site not found");
      if (!site.isActive) throw new Error("Inactive sites cannot receive new obligation links");

      const obligations = await tx.administrativeObligation.findMany({ where: { id: { in: parsed.data.obligationIds } }, select: { id: true } });
      if (obligations.length !== parsed.data.obligationIds.length) throw new Error("One or more obligations were not found");

      for (const obligation of obligations) {
        await tx.administrativeObligationSite.upsert({
          where: { obligationId_siteId: { obligationId: obligation.id, siteId: site.id } },
          update: { scopeRole: cleanOptionalString(parsed.data.scopeRole) },
          create: { obligationId: obligation.id, siteId: site.id, scopeRole: cleanOptionalString(parsed.data.scopeRole) },
        });
        await audit(session.userId, "corporate.obligation.site.linked", obligation.id, { siteId: site.id }, tx);
      }
      return { affected: obligations.length };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bulk operation failed" }, { status: 400 });
  }
}

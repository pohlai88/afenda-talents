import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, createObligationSiteSchema } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const { id: obligationId } = await params;
  const parsed = createObligationSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site relationship" }, { status: 400 });

  const [obligation, site] = await Promise.all([
    db.administrativeObligation.findUnique({ where: { id: obligationId }, select: { id: true } }),
    db.administrativeSite.findUnique({ where: { id: parsed.data.siteId }, select: { id: true, isActive: true } }),
  ]);
  if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  if (!site.isActive) return NextResponse.json({ error: "Inactive sites cannot receive new obligation links" }, { status: 409 });

  const priorLink = await db.administrativeObligationSite.findUnique({
    where: { obligationId_siteId: { obligationId, siteId: parsed.data.siteId } },
    select: { isActive: true },
  });

  const link = await db.administrativeObligationSite.upsert({
    where: { obligationId_siteId: { obligationId, siteId: parsed.data.siteId } },
    update: { scopeRole: cleanOptionalString(parsed.data.scopeRole), notes: cleanOptionalString(parsed.data.notes), isActive: true },
    create: { obligationId, siteId: parsed.data.siteId, scopeRole: cleanOptionalString(parsed.data.scopeRole), notes: cleanOptionalString(parsed.data.notes) },
  });
  const reactivated = priorLink?.isActive === false;
  await audit(session.userId, "corporate.obligation.site.linked", obligationId, reactivated ? { siteId: link.siteId, reactivated: true } : { siteId: link.siteId });
  return NextResponse.json({ site: { id: link.siteId } });
}

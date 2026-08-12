import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, createServiceCoverageSchema, parseDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const { id: siteId } = await params;
  const parsed = createServiceCoverageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service coverage" }, { status: 400 });

  const [site, counterparty] = await Promise.all([
    db.administrativeSite.findUnique({ where: { id: siteId }, select: { id: true } }),
    db.administrativeCounterparty.findUnique({ where: { id: parsed.data.counterpartyId }, select: { id: true, isActive: true } }),
  ]);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  if (!counterparty) return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
  if (!counterparty.isActive) return NextResponse.json({ error: "Inactive counterparties cannot receive new service coverage" }, { status: 409 });

  const coverage = await db.administrativeServiceCoverage.create({ data: {
    siteId,
    counterpartyId: parsed.data.counterpartyId,
    serviceCategory: parsed.data.serviceCategory,
    roleCode: cleanOptionalString(parsed.data.roleCode),
    effectiveFrom: parsed.data.effectiveFrom ? parseDateOnly(parsed.data.effectiveFrom) : null,
    effectiveTo: parsed.data.effectiveTo ? parseDateOnly(parsed.data.effectiveTo) : null,
    isPrimary: parsed.data.isPrimary,
    isActive: parsed.data.isActive,
    serviceLevel: cleanOptionalString(parsed.data.serviceLevel),
    emergencyContact: cleanOptionalString(parsed.data.emergencyContact),
    notes: cleanOptionalString(parsed.data.notes),
  }});
  await audit(session.userId, "corporate.site.coverage.created", coverage.id, { siteId, counterpartyId: coverage.counterpartyId, serviceCategory: coverage.serviceCategory });
  return NextResponse.json({ coverage: { id: coverage.id } });
}

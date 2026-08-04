import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { applyStatus, canTransition, type Status } from "@/lib/status";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canTransition(candidate.status as Status, "REVOKED")) {
    return NextResponse.json(
      { error: `Cannot revoke from status ${candidate.status}` },
      { status: 409 },
    );
  }

  await applyStatus(id, "REVOKED");
  await db.candidate.update({ where: { id }, data: { tokenHash: null } });
  await audit("admin", "invite.revoked", id);

  return NextResponse.json({ ok: true });
}

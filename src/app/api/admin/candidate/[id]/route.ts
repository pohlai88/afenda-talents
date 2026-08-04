import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * The PDPA erasure right: deletes one candidate entirely. Responses and the result
 * cascade from the schema's onDelete rules. The audit row keeps only the id.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id }, select: { id: true } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.candidate.delete({ where: { id } });
  await audit("admin", "candidate.deleted", id);

  return NextResponse.json({ ok: true });
}

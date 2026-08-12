import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { relationalImportPayloadSchema } from "@/lib/corporate-admin/relational-import";
import { buildRelationalImportPlan } from "@/lib/corporate-admin/relational-import-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = relationalImportPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import payload" }, { status: 400 });
  try { return NextResponse.json(await buildRelationalImportPlan(parsed.data.target, parsed.data.rows)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not preview relational import" }, { status: 400 }); }
}

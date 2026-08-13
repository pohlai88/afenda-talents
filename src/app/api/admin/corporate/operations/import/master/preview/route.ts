import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { masterImportPayloadSchema } from "@/lib/corporate-admin/master-import";
import { buildMasterImportPlan } from "@/lib/corporate-admin/master-import-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = masterImportPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import payload" }, { status: 400 });
  try { return NextResponse.json(await buildMasterImportPlan(parsed.data.target, parsed.data.rows)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not preview import" }, { status: 400 }); }
}

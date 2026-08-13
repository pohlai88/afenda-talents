import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { corporateImportPayloadSchema } from "@/lib/corporate-admin/safe-import";
import { buildCorporateImportPlan } from "@/lib/corporate-admin/safe-import-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = corporateImportPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import payload" }, { status: 400 });

  try {
    const plan = await buildCorporateImportPlan(parsed.data);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not preview import" }, { status: 400 });
  }
}

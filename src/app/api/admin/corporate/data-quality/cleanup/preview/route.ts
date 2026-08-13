import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanupResolutionRequestSchema } from "@/lib/corporate-admin/cleanup-resolution";
import { buildCleanupResolutionPlan } from "@/lib/corporate-admin/cleanup-resolution-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = cleanupResolutionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cleanup request" }, { status: 400 });
  try { return NextResponse.json(await buildCleanupResolutionPlan(parsed.data)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not preview cleanup" }, { status: 400 }); }
}

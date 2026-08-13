import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanupResolutionCommitSchema } from "@/lib/corporate-admin/cleanup-resolution";
import { applyCleanupResolution } from "@/lib/corporate-admin/cleanup-resolution-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = cleanupResolutionCommitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cleanup commit" }, { status: 400 });
  try { return NextResponse.json(await applyCleanupResolution(parsed.data.request, session.userId, parsed.data.previewHash)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Could not commit cleanup";
    return NextResponse.json({ error: message }, { status: message.includes("stale") ? 409 : 400 });
  }
}

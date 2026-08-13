import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { updateWorkItem } from "@/lib/corporate-admin/work-items-server";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const { id } = await params;
  try {
    await updateWorkItem(id, await request.json().catch(() => null), session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update work item";
    return NextResponse.json({ error: message }, { status: message === "Work item not found" ? 404 : 400 });
  }
}

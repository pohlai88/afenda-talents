import { NextResponse } from "next/server";

import { requireWorkspaceAdmin, requireWorkspaceUser } from "@/lib/auth-workspace";
import { createWorkItem, listWorkItems } from "@/lib/corporate-admin/work-items-server";

export const runtime = "nodejs";

export async function GET() {
  try { await requireWorkspaceUser(); }
  catch { return NextResponse.json({ error: "Workspace access required" }, { status: 403 }); }
  return NextResponse.json({ workItems: await listWorkItems() });
}

export async function POST(request: Request) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  try {
    const id = await createWorkItem(await request.json().catch(() => null), session.userId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create work item" }, { status: 400 });
  }
}

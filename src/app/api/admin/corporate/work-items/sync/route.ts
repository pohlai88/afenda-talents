import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { materializeOperationalWorkItems, refreshEscalations } from "@/lib/corporate-admin/work-items-server";

export const runtime = "nodejs";

export async function POST() {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const today = new Date().toISOString().slice(0, 10);
  const created = await materializeOperationalWorkItems(today, session.userId);
  const escalated = await refreshEscalations(today, session.userId);
  return NextResponse.json({ created, escalated, today });
}

import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { masterImportCommitSchema } from "@/lib/corporate-admin/master-import";
import { applyMasterImport } from "@/lib/corporate-admin/master-import-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = masterImportCommitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import payload" }, { status: 400 });
  try {
    const result = await applyMasterImport(parsed.data.target, parsed.data.rows, session.userId, parsed.data.previewHash);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not commit import";
    return NextResponse.json({ error: message }, { status: message.includes("stale") ? 409 : 400 });
  }
}

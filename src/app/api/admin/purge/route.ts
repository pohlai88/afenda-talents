import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const CONFIRMATION = "DELETE ALL CANDIDATE DATA";
const bodySchema = z.object({ confirmation: z.string() });

/**
 * The end-of-round action the consent text's retention promise depends on. Audit rows
 * survive as proof the purge happened — they hold no names or emails (invariant 6),
 * so nothing identifying remains after this call.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Type exactly: ${CONFIRMATION}` }, { status: 400 });
  }

  const { count } = await db.candidate.deleteMany({});
  await audit(session.userId, "data.purged", undefined, { deletedCount: count });

  return NextResponse.json({ deleted: count });
}

import { NextResponse } from "next/server";
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
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Type exactly: ${CONFIRMATION}` }, { status: 400 });
  }

  const { count } = await db.candidate.deleteMany({});
  await audit("admin", "data.purged", undefined, { deletedCount: count });

  return NextResponse.json({ deleted: count });
}

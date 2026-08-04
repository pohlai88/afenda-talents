import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCandidate } from "@/lib/auth-candidate";

export const runtime = "nodejs";

const bodySchema = z.object({
  itemId: z.string().min(1),
  value: z.number().int().min(1).max(5),
  msOnItem: z.number().int().min(0),
});

export async function POST(request: Request) {
  let candidate;
  try {
    candidate = await requireCandidate();
  } catch {
    return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });

  const { itemId, value, msOnItem } = parsed.data;
  const item = await db.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // msOnItem accumulates across visits so a resumed sitting adds to the earlier time.
  // The scoring engine clamps per item, so accumulation cannot inflate totalSeconds.
  const existing = await db.response.findUnique({
    where: { candidateId_itemId: { candidateId: candidate.id, itemId } },
    select: { msOnItem: true },
  });

  await db.response.upsert({
    where: { candidateId_itemId: { candidateId: candidate.id, itemId } },
    update: { value, msOnItem: (existing?.msOnItem ?? 0) + msOnItem },
    create: { candidateId: candidate.id, itemId, value, msOnItem },
  });

  return NextResponse.json({ ok: true });
}

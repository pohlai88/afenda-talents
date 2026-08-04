import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CANDIDATE_COOKIE, requireCandidate } from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";
import { score, type ItemDef } from "@/lib/scoring";
import { sendReceipt } from "@/lib/email";

export const runtime = "nodejs";

export async function POST() {
  let candidate;
  try {
    candidate = await requireCandidate();
  } catch {
    return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
  }

  const [items, responses] = await Promise.all([
    db.item.findMany({ orderBy: { order: "asc" } }),
    db.response.findMany({ where: { candidateId: candidate.id } }),
  ]);

  const answeredIds = new Set(responses.map((r) => r.itemId));
  const unanswered = items.filter((i) => !answeredIds.has(i.id)).map((i) => i.id);
  if (unanswered.length > 0) {
    return NextResponse.json(
      { error: "Please answer every statement before submitting.", unanswered },
      { status: 400 },
    );
  }

  // Scoring is pure: items and responses in, scores out. Response rows are read and
  // never written here, so a Result stays recomputable from them alone.
  const scored = score(
    items as ItemDef[],
    responses.map((r) => ({ itemId: r.itemId, value: r.value, msOnItem: r.msOnItem })),
  );

  // Server-observed elapsed window, stored beside the self-reported total (D6).
  const stamps = responses.map((r) => r.updatedAt.getTime());
  const serverWindowSeconds = Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000);

  await applyStatus(candidate.id, "SUBMITTED", { submittedAt: new Date() });

  await db.result.upsert({
    where: { candidateId: candidate.id },
    update: {
      dimensionScores: scored.dimensions,
      validityFlags: scored.flags,
      totalSeconds: scored.totalSeconds,
      serverWindowSeconds,
    },
    create: {
      candidateId: candidate.id,
      dimensionScores: scored.dimensions,
      validityFlags: scored.flags,
      totalSeconds: scored.totalSeconds,
      serverWindowSeconds,
    },
  });

  await applyStatus(candidate.id, "SCORED");
  await audit("candidate", "assessment.submitted", candidate.id, {
    itemCount: items.length,
    totalSeconds: scored.totalSeconds,
  });

  await sendReceipt(candidate.email, candidate.fullName);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CANDIDATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

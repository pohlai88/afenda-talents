import { NextResponse } from "next/server";
import { requireCandidate } from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  let candidate;
  try {
    candidate = await requireCandidate();
  } catch {
    return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
  }

  if (candidate.status === "STARTED") return NextResponse.json({ ok: true });

  const now = new Date();
  await applyStatus(candidate.id, "STARTED", { consentedAt: now, startedAt: now });
  await audit("candidate", "candidate.consented", candidate.id);

  return NextResponse.json({ ok: true });
}

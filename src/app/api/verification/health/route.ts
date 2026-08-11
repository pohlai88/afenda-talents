import { NextResponse } from "next/server";
import { getAnonymousJwt } from "@/lib/neon-verification-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getAnonymousJwt();
    return NextResponse.json({ ok: true, authentication: "ready" });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Verification authentication is unavailable" },
      { status: 502 },
    );
  }
}

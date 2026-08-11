import { NextResponse } from "next/server";
import { getAnonymousJwt } from "@/lib/neon-verification-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getAnonymousJwt();
    return NextResponse.json({ ok: true, jwt: token.split(".").length === 3 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Neon authentication failed" },
      { status: 502 },
    );
  }
}

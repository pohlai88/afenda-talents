import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET() {
  return NextResponse.json(
    { ok: true, service: "afenda-talents" },
    { headers },
  );
}

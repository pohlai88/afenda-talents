import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

async function checkDatabase(timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("readiness timeout")), timeoutMs);
  });

  try {
    await Promise.race([db.$queryRaw`SELECT 1`, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const startedAt = Date.now();
  try {
    await checkDatabase(3_000);
    return NextResponse.json(
      {
        ok: true,
        service: "afenda-talents",
        database: "ready",
        durationMs: Date.now() - startedAt,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "afenda-talents",
        database: "unavailable",
        durationMs: Date.now() - startedAt,
      },
      { status: 503, headers },
    );
  }
}

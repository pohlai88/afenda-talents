import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ADMIN_COOKIE, createAdminToken, passwordMatches } from "@/lib/auth-admin";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(1) });

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ip = clientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  if (!passwordMatches(parsed.data.password, env.ADMIN_PASSWORD)) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await clearFailures(ip);
  await audit("admin", "admin.login");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}

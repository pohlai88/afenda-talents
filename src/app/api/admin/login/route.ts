import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, createSessionToken, type Role } from "@/lib/auth-admin";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.email(), password: z.string().min(1) });

// A fixed dummy hash keeps timing comparable when the email is unknown.
const DUMMY_HASH = hashPassword("timing-equalisation-only");

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }

  const ip = clientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const ok = verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  await clearFailures(ip);
  await audit(user.id, "admin.login");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_COOKIE,
    await createSessionToken({ userId: user.id, role: user.role as Role }),
    {
      httpOnly: true,
      secure: process.env.APP_URL?.startsWith("https") ?? false,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    },
  );
  return response;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * A signed-in hiring user replaces their own password. Both roles may call this —
 * a VIEWER owns their credential too. Proving the current password is the fine
 * check; the cookie alone is the coarse one (D7). Wrong-current attempts count
 * against the same IP rate limit as login, because this endpoint is equally
 * brute-forceable once a cookie is stolen.
 */
const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(200),
});

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your current password and a new one of at least 12 characters" },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return NextResponse.json(
      { error: "Choose a password different from the current one" },
      { status: 400 },
    );
  }

  await clearFailures(ip);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.newPassword), mustChangePassword: false },
  });
  await audit(user.id, "user.password_changed", user.id);

  return NextResponse.json({ ok: true });
}

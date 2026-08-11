import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createSessionToken,
  requirePasswordChangeUser,
} from "@/lib/auth-admin";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(200),
});

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET() {
  let session;
  try {
    session = await requirePasswordChangeUser();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, mustChangePassword: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json(user);
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requirePasswordChangeUser();
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

  const updated = await db.$transaction(async (tx) => {
    const nextUser = await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(parsed.data.newPassword),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, sessionVersion: true },
    });
    await audit(nextUser.id, "user.password_changed", nextUser.id, undefined, tx);
    return nextUser;
  });

  await clearFailures(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_COOKIE,
    await createSessionToken({
      userId: updated.id,
      sessionVersion: updated.sessionVersion,
    }),
    adminCookieOptions(8 * 60 * 60),
  );
  return response;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generatePassword, hashPassword } from "@/lib/passwords";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/rate-limit";
import { matchesSha256Token } from "@/lib/one-time-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOVERY_TOKEN_HASH =
  "493b8565ab4070c5a74912f8b9062c0c0b1c3e1eee8de2bddef9e36a191528e5";
const RECOVERY_AUDIT_ACTION = "user.password_recovery.completed";

const bodySchema = z.object({
  token: z.string().min(40).max(128),
  newPassword: z.string().min(24).max(256),
});

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function recover(token: string, newPassword: string, ip: string) {
  if (await isRateLimited(ip)) {
    return noStore({ error: "Recovery is temporarily unavailable" }, 429);
  }
  if (!matchesSha256Token(token, RECOVERY_TOKEN_HASH)) {
    await recordFailure(ip);
    return noStore({ error: "Recovery request is invalid" }, 401);
  }

  const user = await db.user.findUnique({
    where: { email: env.ADMIN_EMAIL.toLowerCase() },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "ADMIN") {
    return noStore({ error: "Designated administrator is unavailable" }, 409);
  }

  const alreadyUsed = await db.auditEvent.findFirst({
    where: { action: RECOVERY_AUDIT_ACTION, subjectId: user.id },
    select: { id: true },
  });
  if (alreadyUsed) {
    return noStore({ error: "Recovery request has already been used" }, 410);
  }

  const passwordHash = hashPassword(newPassword);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    }),
    db.auditEvent.create({
      data: {
        actor: user.id,
        action: RECOVERY_AUDIT_ACTION,
        subjectId: user.id,
        meta: { mode: "one-time-recovery" },
      },
    }),
  ]);

  await clearFailures(ip);
  return noStore({ ok: true, temporaryPassword: newPassword, mustChangePassword: true });
}

/**
 * Temporary, single-use recovery route for the designated production administrator.
 * It is intentionally absent from every UI and is removed immediately after use.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return noStore({ error: "Recovery request is invalid" }, 400);
  }
  return recover(parsed.data.token, parsed.data.newPassword, clientIp(request));
}

/**
 * Operational GET adapter for the connected deployment fetch tool, which cannot issue
 * POST requests. The high-entropy token is single-use, and this route is deleted as
 * soon as the password is returned and verified.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const newPassword = generatePassword();
  return recover(token, newPassword, clientIp(request));
}

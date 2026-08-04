import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, ROLES } from "@/lib/auth-admin";
import { hashPassword, generatePassword } from "@/lib/passwords";

export const runtime = "nodejs";

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  resetPassword: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // An admin may not demote themselves — the system must always keep one reachable admin.
  if (parsed.data.role === "VIEWER" && id === session.userId) {
    return NextResponse.json({ error: "You cannot demote your own account" }, { status: 409 });
  }

  let temporaryPassword: string | undefined;
  const data: Record<string, unknown> = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.resetPassword) {
    temporaryPassword = generatePassword();
    data.passwordHash = hashPassword(temporaryPassword);
  }

  await db.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true, temporaryPassword });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "You cannot remove your own account" }, { status: 409 });
  }
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

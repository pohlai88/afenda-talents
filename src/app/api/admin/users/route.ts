import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, ROLES } from "@/lib/auth-admin";
import { hashPassword, generatePassword } from "@/lib/passwords";

export const runtime = "nodejs";

const createSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a name, valid email, and role" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "That email already has an account" }, { status: 409 });
  }

  // The temporary password is returned exactly once, to the admin who created the
  // account, for hand-over out of band. It is never stored in plain text or audited.
  const temporaryPassword = generatePassword();
  const user = await db.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      passwordHash: hashPassword(temporaryPassword),
      // A password issued by someone else must be replaced on first sign-in.
      mustChangePassword: true,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user, temporaryPassword });
}

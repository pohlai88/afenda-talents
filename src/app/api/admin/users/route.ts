import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, ROLES } from "@/lib/auth-admin";
import { hashPassword, generatePassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";

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
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a name, valid email, and role" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json(
      { error: "That email already has an account" },
      { status: 409 },
    );
  }

  const temporaryPassword = generatePassword();
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        role: parsed.data.role,
        passwordHash: hashPassword(temporaryPassword),
        mustChangePassword: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    await audit(
      session.userId,
      "user.created",
      created.id,
      { role: created.role },
      tx,
    );
    return created;
  });

  return NextResponse.json({ user, temporaryPassword });
}

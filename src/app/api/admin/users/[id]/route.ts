import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, ROLES } from "@/lib/auth-admin";
import { hashPassword, generatePassword } from "@/lib/passwords";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  resetPassword: z.boolean().optional(),
});

class UserPolicyConflict extends Error {}

async function lockAdministratorPolicy(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('afenda-talents:user-admin-policy'))`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (parsed.data.role === "VIEWER" && id === session.userId) {
    return NextResponse.json(
      { error: "You cannot demote your own account" },
      { status: 409 },
    );
  }

  let temporaryPassword: string | undefined;
  try {
    await db.$transaction(async (tx) => {
      await lockAdministratorPolicy(tx);
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new UserPolicyConflict("User not found");

      const nextRole = parsed.data.role ?? user.role;
      const roleChanged = nextRole !== user.role;
      if (user.role === "ADMIN" && nextRole !== "ADMIN") {
        const administratorCount = await tx.user.count({ where: { role: "ADMIN" } });
        if (administratorCount <= 1) {
          throw new UserPolicyConflict("The workspace must retain an administrator");
        }
      }

      const data: Prisma.UserUpdateInput = {};
      if (roleChanged) data.role = nextRole;
      if (parsed.data.resetPassword) {
        temporaryPassword = generatePassword();
        data.passwordHash = hashPassword(temporaryPassword);
        data.mustChangePassword = true;
      }
      if (roleChanged || parsed.data.resetPassword) {
        data.sessionVersion = { increment: 1 };
      }

      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data });
      }
      if (roleChanged) {
        await audit(
          session.userId,
          "user.role_changed",
          id,
          { previousRole: user.role, nextRole },
          tx,
        );
      }
      if (parsed.data.resetPassword) {
        await audit(session.userId, "user.password_reset", id, undefined, tx);
      }
    });
  } catch (error) {
    if (error instanceof UserPolicyConflict) {
      const status = error.message === "User not found" ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, temporaryPassword });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json(
      { error: "You cannot remove your own account" },
      { status: 409 },
    );
  }

  try {
    await db.$transaction(async (tx) => {
      await lockAdministratorPolicy(tx);
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });
      if (!user) throw new UserPolicyConflict("User not found");
      if (user.role === "ADMIN") {
        const administratorCount = await tx.user.count({ where: { role: "ADMIN" } });
        if (administratorCount <= 1) {
          throw new UserPolicyConflict("The workspace must retain an administrator");
        }
      }
      await tx.user.delete({ where: { id } });
      await audit(session.userId, "user.removed", id, undefined, tx);
    });
  } catch (error) {
    if (error instanceof UserPolicyConflict) {
      const status = error.message === "User not found" ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}

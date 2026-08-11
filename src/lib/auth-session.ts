import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type {
  HiringSession,
  HiringSessionClaims,
} from "@/lib/hiring-roles";

const secret = () => new TextEncoder().encode(env.APP_SECRET);

export async function verifyHiringSessionToken(
  token: string | undefined,
): Promise<HiringSessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string") return null;
    if (
      typeof payload.sessionVersion !== "number" ||
      !Number.isInteger(payload.sessionVersion) ||
      payload.sessionVersion < 0
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

export async function resolveHiringSession(
  token: string | undefined,
): Promise<HiringSession | null> {
  const claims = await verifyHiringSessionToken(token);
  if (!claims) return null;

  const user = await db.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      role: true,
      mustChangePassword: true,
      sessionVersion: true,
    },
  });
  if (!user || user.sessionVersion !== claims.sessionVersion) return null;

  return {
    userId: user.id,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  };
}

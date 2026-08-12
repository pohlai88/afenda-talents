import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import {
  assertRoundTransition,
  IllegalRoundTransition,
  ROUND_STATUSES,
} from "@/lib/status-constants";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    assessmentVersionId: z.string().min(1).optional(),
    status: z.enum(ROUND_STATUSES).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.assessmentVersionId !== undefined ||
      body.status !== undefined,
    { message: "Provide at least one field to update" },
  );

const STATUS_AUDIT_ACTION = {
  OPEN: "round.opened",
  CLOSED: "round.closed",
  ARCHIVED: "round.archived",
} as const;

class RoundRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RoundRequestError";
  }
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

  try {
    const updated = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "HiringRound"
        WHERE "id" = ${id}
        FOR UPDATE
      `;
      if (locked.length !== 1) {
        throw new RoundRequestError("Hiring round not found", 404);
      }

      const round = await tx.hiringRound.findUnique({ where: { id } });
      if (!round) throw new RoundRequestError("Hiring round not found", 404);

      const { name, assessmentVersionId, status } = parsed.data;
      const data: Prisma.HiringRoundUpdateInput = {};

      if (name !== undefined || assessmentVersionId !== undefined) {
        if (round.status !== "DRAFT") {
          throw new RoundRequestError(
            "Only a draft round's name or assessment version can be changed",
            409,
          );
        }
        if (name !== undefined) data.name = name.trim();
        if (assessmentVersionId !== undefined) {
          const version = await tx.assessmentVersion.findUnique({
            where: { id: assessmentVersionId },
            select: { id: true },
          });
          if (!version) {
            throw new RoundRequestError("Assessment version not found", 404);
          }
          data.assessmentVersion = { connect: { id: assessmentVersionId } };
        }
      }

      if (status !== undefined) {
        try {
          assertRoundTransition(round.status, status);
        } catch (error) {
          if (error instanceof IllegalRoundTransition) {
            throw new RoundRequestError(error.message, 409);
          }
          throw error;
        }
        data.status = status;
      }

      const next = await tx.hiringRound.update({ where: { id }, data });
      if (status !== undefined) {
        const action =
          STATUS_AUDIT_ACTION[status as keyof typeof STATUS_AUDIT_ACTION];
        if (action) {
          await audit(
            session.userId,
            action,
            round.id,
            { assessmentVersionId: next.assessmentVersionId },
            tx,
          );
        }
      }
      return next;
    });

    return NextResponse.json({
      round: { id: updated.id, name: updated.name, status: updated.status },
    });
  } catch (error) {
    if (error instanceof RoundRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

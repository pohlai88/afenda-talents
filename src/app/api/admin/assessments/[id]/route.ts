import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  draftInstrumentDocumentSchema,
  parseDraftDocument,
} from "@/lib/instrument-draft";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    draftDocument: draftInstrumentDocumentSchema.optional(),
    expectedRevision: z.number().int().min(0).optional(),
    status: z.enum(["ARCHIVED"]).optional(),
  })
  .superRefine((body, context) => {
    const editsDraft = body.title !== undefined || body.draftDocument !== undefined;
    if (!editsDraft && body.status === undefined) {
      context.addIssue({ code: "custom", message: "Provide a field to update" });
    }
    if (editsDraft && body.expectedRevision === undefined) {
      context.addIssue({
        code: "custom",
        path: ["expectedRevision"],
        message: "Draft revision is required",
      });
    }
    if (body.status !== undefined && editsDraft) {
      context.addIssue({
        code: "custom",
        message: "Archive and draft edits must be separate requests",
      });
    }
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          publishedAt: true,
          publishedById: true,
        },
      },
    },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: assessment.id,
    title: assessment.title,
    kind: assessment.kind,
    isSystem: assessment.isSystem,
    status: assessment.status,
    draftDocument: assessment.draftDocument,
    draftRevision: assessment.draftRevision,
    versions: assessment.versions,
  });
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

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { id } = await params;

  if (parsed.data.status === "ARCHIVED") {
    try {
      await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Assessment"
          WHERE "id" = ${id}
          FOR UPDATE
        `;
        if (locked.length !== 1) throw new Error("not-found");
        const assessment = await tx.assessment.findUnique({ where: { id } });
        if (!assessment) throw new Error("not-found");
        if (assessment.isSystem) throw new Error("system");
        if (assessment.status === "ARCHIVED") return;
        await tx.assessment.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
        await audit(session.userId, "assessment.archived", id, undefined, tx);
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "not-found") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (error instanceof Error && error.message === "system") {
        return NextResponse.json(
          { error: "System assessments cannot be archived" },
          { status: 409 },
        );
      }
      throw error;
    }
  }

  const expectedRevision = parsed.data.expectedRevision!;
  const draft =
    parsed.data.draftDocument !== undefined
      ? parseDraftDocument(parsed.data.draftDocument)
      : undefined;
  const title =
    draft?.title.trim() || parsed.data.title?.trim() || undefined;
  const updated = await db.assessment.updateMany({
    where: {
      id,
      status: { not: "ARCHIVED" },
      draftRevision: expectedRevision,
    },
    data: {
      ...(title ? { title } : {}),
      ...(draft ? { draftDocument: draft } : {}),
      draftRevision: { increment: 1 },
    },
  });

  if (updated.count !== 1) {
    const current = await db.assessment.findUnique({
      where: { id },
      select: { status: true, draftRevision: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (current.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Archived assessments cannot be edited" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: "This draft changed in another session. Reload before continuing.",
        currentRevision: current.draftRevision,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    savedAt: new Date().toISOString(),
    draftRevision: expectedRevision + 1,
  });
}

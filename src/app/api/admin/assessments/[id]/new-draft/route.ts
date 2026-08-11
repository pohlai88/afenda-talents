import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDraftDocument } from "@/lib/instrument-draft";
import { parseInstrumentDocument } from "@/lib/instrument-document";

export const runtime = "nodejs";

class NewDraftError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NewDraftError";
  }
}

/** Create a new editable draft from the latest published version. */
export async function POST(
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
  try {
    const revision = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Assessment"
        WHERE "id" = ${id}
        FOR UPDATE
      `;
      if (locked.length !== 1) throw new NewDraftError("Not found", 404);

      const assessment = await tx.assessment.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });
      if (!assessment) throw new NewDraftError("Not found", 404);
      if (assessment.status === "ARCHIVED") {
        throw new NewDraftError("Archived assessments have no draft", 409);
      }
      if (assessment.draftDocument) {
        throw new NewDraftError("A draft already exists", 409);
      }

      const latest = assessment.versions[0];
      if (!latest) {
        throw new NewDraftError("No published version to copy", 400);
      }

      const document = parseInstrumentDocument(latest.document);
      const draft = parseDraftDocument(document);
      const updated = await tx.assessment.update({
        where: { id },
        data: {
          draftDocument: draft,
          status: assessment.isSystem ? "PUBLISHED" : "DRAFT",
          draftRevision: { increment: 1 },
        },
        select: { draftRevision: true },
      });
      await audit(
        session.userId,
        "assessment.created",
        id,
        {
          fromVersionId: latest.id,
          action: "new_draft_version",
        },
        tx,
      );
      return updated.draftRevision;
    });

    return NextResponse.json({ ok: true, draftRevision: revision });
  } catch (error) {
    if (error instanceof NewDraftError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

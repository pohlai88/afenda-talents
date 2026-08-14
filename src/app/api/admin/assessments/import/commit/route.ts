import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDraftDocument } from "@/lib/instrument-draft";
import {
  ImportTargetError,
  assertImportableTarget,
  importCommitSchema,
  issueCounts,
  runImportPreview,
} from "@/lib/instrument-import";

export const runtime = "nodejs";

class ImportCommitError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ImportCommitError";
  }
}

/**
 * Apply a previewed import as the assessment's draft.
 *
 * The upload is re-parsed here against the target as it stands now, and the
 * result must still hash to what the preview showed. That is what makes the
 * two-step safe: the client sends bytes, never a document, and a target edited
 * between preview and commit produces a different hash and is refused rather
 * than silently overwritten.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = importCommitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import payload" },
      { status: 400 },
    );
  }

  const { targetId, previewHash, ...input } = parsed.data;
  const preview = { ...input, targetId };

  try {
    // ---- Create a new assessment from the upload -------------------------
    if (targetId === null) {
      const outcome = await runImportPreview({
        input: preview,
        target: null,
        liveDraftRevision: null,
        livePublishedVersionNumber: null,
      });
      if ("refuse" in outcome) throw new ImportCommitError(outcome.refuse, 400);
      if (outcome.documentHash !== previewHash) {
        throw new ImportCommitError("The file changed since it was previewed", 409);
      }
      if (!outcome.committable) {
        throw new ImportCommitError("Resolve the blocking issues before importing", 400);
      }

      const draft = parseDraftDocument(outcome.document);
      const counts = issueCounts(outcome.issues);
      const created = await db.assessment.create({
        data: {
          title: draft.title,
          kind: "ORGANISATION",
          isSystem: false,
          status: "DRAFT",
          draftDocument: draft,
        },
      });
      await audit(session.userId, "assessment.imported", created.id, {
        format: input.format,
        created: true,
        softIssues: counts.soft,
      });
      return NextResponse.json({ id: created.id, created: true });
    }

    // ---- Replace the draft of an existing assessment ---------------------
    const result = await db.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Assessment"
          WHERE "id" = ${targetId}
          FOR UPDATE
        `;
        if (locked.length !== 1) throw new ImportCommitError("Not found", 404);

        const assessment = await tx.assessment.findUnique({
          where: { id: targetId },
          include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        });
        if (!assessment) throw new ImportCommitError("Not found", 404);
        try {
          assertImportableTarget(assessment);
        } catch (error) {
          if (error instanceof ImportTargetError) {
            throw new ImportCommitError(error.message, error.status);
          }
          throw error;
        }

        const outcome = await runImportPreview({
          input: preview,
          target:
            assessment.draftDocument ?? assessment.versions[0]?.document ?? null,
          liveDraftRevision: assessment.draftRevision,
          livePublishedVersionNumber:
            assessment.versions[0]?.versionNumber ?? null,
        });
        if ("refuse" in outcome) throw new ImportCommitError(outcome.refuse, 400);
        if (outcome.documentHash !== previewHash) {
          throw new ImportCommitError(
            "This assessment changed since the preview — review the import again",
            409,
          );
        }
        if (!outcome.committable) {
          throw new ImportCommitError(
            "Resolve the blocking issues before importing",
            400,
          );
        }

        const draft = parseDraftDocument(outcome.document);
        const counts = issueCounts(outcome.issues);
        const updated = await tx.assessment.update({
          where: { id: targetId },
          data: {
            draftDocument: draft,
            title: draft.title,
            status: assessment.isSystem ? "PUBLISHED" : "DRAFT",
            draftRevision: { increment: 1 },
          },
          select: { draftRevision: true },
        });
        await audit(
          session.userId,
          "assessment.imported",
          targetId,
          {
            format: input.format,
            created: false,
            softIssues: counts.soft,
          },
          tx,
        );
        return { id: targetId, draftRevision: updated.draftRevision };
      },
      { timeout: 20_000 },
    );

    return NextResponse.json({ ...result, created: false });
  } catch (error) {
    if (error instanceof ImportCommitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not commit import" },
      { status: 400 },
    );
  }
}

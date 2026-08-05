import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  collectPublishIssues,
  parseDraftDocument,
  publishBlockers,
  type PublishIssue,
} from "@/lib/instrument-draft";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { assertInstrumentInvariants } from "@/lib/instrument-invariants";

export const runtime = "nodejs";

/** Invariant issues carry a document path; completeness issues do not. */
type PublishResponseIssue = PublishIssue & { path?: string };

class PublishRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: PublishResponseIssue[],
    readonly detail?: string,
  ) {
    super(message);
    this.name = "PublishRequestError";
  }
}

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
    const outcome = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Assessment"
        WHERE "id" = ${id}
        FOR UPDATE
      `;
      if (locked.length !== 1) {
        throw new PublishRequestError("Not found", 404);
      }

      const assessment = await tx.assessment.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });
      if (!assessment) throw new PublishRequestError("Not found", 404);
      if (assessment.status === "ARCHIVED") {
        throw new PublishRequestError(
          "Cannot publish an archived assessment",
          409,
        );
      }
      if (!assessment.draftDocument) {
        throw new PublishRequestError("No draft to publish", 400);
      }

      const draft = parseDraftDocument(assessment.draftDocument);
      let document;
      try {
        document = parseInstrumentDocument(draft);
      } catch (error) {
        throw new PublishRequestError(
          "Draft failed structural validation",
          400,
          undefined,
          error instanceof Error ? error.message : "Invalid document",
        );
      }

      // Report invariant and completeness problems together, so one publish
      // attempt surfaces every blocker rather than only the first class of them.
      const invariantErrors = assertInstrumentInvariants(document, "publish").map(
        (i) => ({
          level: "error" as const,
          code: i.code,
          message: i.message,
          path: i.path,
        }),
      );
      const issues = collectPublishIssues(document);
      if (invariantErrors.length > 0 || publishBlockers(issues).length > 0) {
        throw new PublishRequestError("Publish blocked", 400, [
          ...invariantErrors,
          ...issues,
        ]);
      }

      const nextNumber = (assessment.versions[0]?.versionNumber ?? 0) + 1;
      const version = await tx.assessmentVersion.create({
        data: {
          assessmentId: id,
          versionNumber: nextNumber,
          document,
          publishedById: session.userId,
        },
      });
      await tx.assessment.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          title: document.title,
          draftDocument: Prisma.DbNull,
          draftRevision: { increment: 1 },
        },
      });
      await audit(
        session.userId,
        "assessment.published",
        id,
        { versionId: version.id, versionNumber: nextNumber },
        tx,
      );

      return {
        version,
        nextNumber,
        warnings: issues.filter((issue) => issue.level === "warning"),
      };
    });

    return NextResponse.json({
      versionId: outcome.version.id,
      versionNumber: outcome.nextNumber,
      warnings: outcome.warnings,
    });
  } catch (error) {
    if (error instanceof PublishRequestError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.issues ? { issues: error.issues } : {}),
          ...(error.detail ? { detail: error.detail } : {}),
        },
        { status: error.status },
      );
    }
    throw error;
  }
}

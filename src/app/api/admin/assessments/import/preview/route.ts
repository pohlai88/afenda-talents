import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import {
  ImportTargetError,
  assertImportableTarget,
  importPreviewSchema,
  runImportPreview,
} from "@/lib/instrument-import";

export const runtime = "nodejs";

/**
 * Dry run: parse the upload against the current target and report what would
 * change. Touches nothing. The returned `documentHash` is what commit must be
 * given back, so an admin can only apply the document they were actually shown.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = importPreviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import payload" },
      { status: 400 },
    );
  }

  const { targetId } = parsed.data;

  let target: unknown | null = null;
  let liveDraftRevision: number | null = null;
  let livePublishedVersionNumber: number | null = null;

  if (targetId) {
    const assessment = await db.assessment.findUnique({
      where: { id: targetId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    try {
      assertImportableTarget(assessment);
    } catch (error) {
      if (error instanceof ImportTargetError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
    // Import edits the draft; fall back to the latest published document when
    // no draft is open, which is what the builder would show.
    target = assessment.draftDocument ?? assessment.versions[0]?.document ?? null;
    liveDraftRevision = assessment.draftRevision;
    livePublishedVersionNumber = assessment.versions[0]?.versionNumber ?? null;
  }

  try {
    const outcome = await runImportPreview({
      input: parsed.data,
      target,
      liveDraftRevision,
      livePublishedVersionNumber,
    });
    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not preview import" },
      { status: 400 },
    );
  }
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssessmentBuilder } from "@/components/assessment-builder/assessment-builder";
import { CreateDraftButton } from "@/components/assessment-builder/create-draft-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { parseDraftDocument } from "@/lib/instrument-draft";

export const dynamic = "force-dynamic";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/assessments");
  }

  const { id } = await params;
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { versionNumber: true },
      },
    },
  });
  if (!assessment) notFound();

  const latestVersionNumber = assessment.versions[0]?.versionNumber ?? null;

  if (assessment.status === "ARCHIVED") {
    return (
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6 p-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          nativeButton={false}
          render={<Link href="/admin/assessments" />}
        >
          ← Assessments
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{assessment.title}</CardTitle>
            <CardDescription>
              This assessment is archived and read-only. Duplicate it from the list if
              you need to keep building on it.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!assessment.draftDocument) {
    return (
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6 p-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          nativeButton={false}
          render={<Link href="/admin/assessments" />}
        >
          ← Assessments
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{assessment.title}</CardTitle>
            <CardDescription>
              {latestVersionNumber !== null
                ? `There is no draft to edit — v${latestVersionNumber} is published and immutable. Start a new draft to make changes; it copies v${latestVersionNumber} as a starting point.`
                : "There is no draft and nothing published yet."}
            </CardDescription>
          </CardHeader>
          {latestVersionNumber !== null ? (
            <CardContent>
              <CreateDraftButton assessmentId={id} />
            </CardContent>
          ) : null}
        </Card>
      </div>
    );
  }

  const draft = parseDraftDocument(assessment.draftDocument);

  return (
    <AssessmentBuilder
      assessmentId={id}
      initialTitle={assessment.title}
      initialDraft={draft}
      initialDraftRevision={assessment.draftRevision}
      isSystem={assessment.isSystem}
      latestVersionNumber={latestVersionNumber}
    />
  );
}

import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { InviteWorkspace } from "@/components/invite-workspace";
import { InviteWorkflow } from "@/components/invite-workflow";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { invitationHtml, receiptHtml } from "@/lib/email";
import { env } from "@/lib/env";
import { requirePageAdmin } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  round?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requirePageAdmin();
  } catch {
    redirect("/admin");
  }

  const requestedRoundId = first((await searchParams).round);
  const [openRounds, assignments] = await Promise.all([
    db.hiringRound.findMany({
      where: { status: "OPEN" },
      include: {
        assessmentVersion: {
          include: { assessment: { select: { title: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.candidateAssignment.findMany({
      select: {
        hiringRoundId: true,
        candidate: { select: { email: true } },
      },
    }),
  ]);

  openRounds.sort((left, right) => {
    if (left.id === requestedRoundId) return -1;
    if (right.id === requestedRoundId) return 1;
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });

  const roundExistingEmails: Record<string, string[]> = {};
  for (const assignment of assignments) {
    const emails = roundExistingEmails[assignment.hiringRoundId] ?? [];
    emails.push(assignment.candidate.email);
    roundExistingEmails[assignment.hiringRoundId] = emails;
  }

  const sampleExpiry = new Date(
    // eslint-disable-next-line react-hooks/purity -- force-dynamic; request-time preview only
    Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const selectedRound = openRounds[0] ?? null;

  return (
    <AdminPage width="content">
      <PageHeader
        eyebrow={selectedRound?.name ?? "Hiring workspace"}
        title="Invite candidates"
        description="Create personal one-time assessment links, review the complete batch, and send only validated candidate records."
        meta={
          selectedRound ? (
            <span className="text-muted-foreground">
              {selectedRound.assessmentVersion.assessment.title} · v
              {selectedRound.assessmentVersion.versionNumber}
            </span>
          ) : undefined
        }
      />
      <InviteWorkflow ttlDays={env.INVITE_TTL_DAYS} />
      <InviteWorkspace
        ttlDays={env.INVITE_TTL_DAYS}
        mailFrom={env.MAIL_FROM}
        openRounds={openRounds.map((round) => ({
          id: round.id,
          name: round.name,
          versionTitle: `${round.assessmentVersion.assessment.title} · v${round.assessmentVersion.versionNumber}`,
        }))}
        roundExistingEmails={roundExistingEmails}
        invitationPreviewHtml={invitationHtml(
          "Jane Candidate",
          "#personal-one-time-link",
          sampleExpiry,
        )}
        receiptPreviewHtml={receiptHtml("Jane Candidate")}
      />
    </AdminPage>
  );
}

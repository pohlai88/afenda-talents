import { redirect } from "next/navigation";
import { InviteForm } from "@/components/invite-form";
import { InviteWorkflow } from "@/components/invite-workflow";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { invitationHtml, receiptHtml } from "@/lib/email";
import { env } from "@/lib/env";

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
    await requireAdmin();
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
    // eslint-disable-next-line react-hooks/purity -- force-dynamic; preview expiry is request-time only
    Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const selectedRound = openRounds[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 overflow-x-hidden p-6">
      <PageHeader
        eyebrow={selectedRound?.name ?? "Hiring workspace"}
        title="Invite candidates"
        description="Each candidate receives a personal one-time link that expires. There are no candidate accounts — the link is the credential."
      />
      <InviteWorkflow ttlDays={env.INVITE_TTL_DAYS} />
      <InviteForm
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
    </div>
  );
}

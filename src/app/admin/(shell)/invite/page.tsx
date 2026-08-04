import { redirect } from "next/navigation";
import { InviteForm } from "@/components/invite-form";
import { InviteWorkflow } from "@/components/invite-workflow";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { invitationHtml, receiptHtml } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Server component so the email preview is rendered from the same builders the sender
 * uses. The sample link is a plain placeholder — no token, real or fake, is minted here.
 *
 * Invitations require an OPEN hiring round (D18) — the round implies the assessment
 * version, so it is selected first. "Already invited" is scoped per round: the same
 * person may hold a separate assignment in a different round.
 */
export default async function InvitePage() {
	try {
		await requireAdmin();
	} catch {
		redirect("/admin");
	}

	const [openRounds, assignments] = await Promise.all([
		db.hiringRound.findMany({
			where: { status: "OPEN" },
			include: {
				assessmentVersion: { include: { assessment: { select: { title: true } } } },
			},
			orderBy: { createdAt: "desc" },
		}),
		db.candidateAssignment.findMany({
			select: { hiringRoundId: true, candidate: { select: { email: true } } },
		}),
	]);

	const roundExistingEmails: Record<string, string[]> = {};
	for (const a of assignments) {
		const emails = roundExistingEmails[a.hiringRoundId] ?? [];
		emails.push(a.candidate.email);
		roundExistingEmails[a.hiringRoundId] = emails;
	}

	const sampleExpiry = new Date(
		// eslint-disable-next-line react-hooks/purity -- force-dynamic; preview expiry is request-time only
		Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
	);

	return (
		<div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 overflow-x-hidden p-6">
			<PageHeader
				eyebrow="This hiring round"
				title="Invite candidates"
				description="Each candidate receives a personal one-time link that expires. There are no candidate accounts — the link is the credential."
			/>
			<InviteWorkflow ttlDays={env.INVITE_TTL_DAYS} />
			<InviteForm
				ttlDays={env.INVITE_TTL_DAYS}
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

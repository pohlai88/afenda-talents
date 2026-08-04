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
 * Existing emails power the review table's "already invited" classification.
 */
export default async function InvitePage() {
	try {
		await requireAdmin();
	} catch {
		redirect("/admin");
	}

	const existing = await db.candidate.findMany({ select: { email: true } });
	// eslint-disable-next-line react-hooks/purity -- sample expiry is request-time; page is force-dynamic
	const sampleExpiry = new Date(
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
				existingEmails={existing.map((c) => c.email)}
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

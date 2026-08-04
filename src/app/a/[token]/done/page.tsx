/**
 * Completion landing for submitted, expired, revoked, and unknown tokens alike.
 * Must not distinguish between them (spec §15 / UI §12.7).
 */
import { CandidateShell } from "@/components/candidate/shell";

export default function DonePage() {
	return (
		<CandidateShell>
			<main
				id="main"
				tabIndex={-1}
				className="mx-auto flex max-w-xl flex-col justify-center px-5 py-12 outline-none"
			>
				<h1 className="text-xl font-semibold tracking-tight">Thank you</h1>
				<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
					If you have just submitted your self-assessment, we have received it. No
					further action is required from you. Your responses will be reviewed
					with the rest of your application.
				</p>
				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					If you were expecting to see questions, this link has already been used
					or is no longer active. Please reply to your invitation email and we
					will help.
				</p>
			</main>
		</CandidateShell>
	);
}

/**
 * Completion landing for submitted, expired, revoked, and unknown tokens alike.
 * Must not distinguish between them (spec §15 / UI §12.7).
 */
export default function DonePage() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12">
			<p className="font-heading text-sm font-semibold tracking-tight text-primary">
				Afenda Talents
			</p>
			<h1 className="mt-6 text-xl font-semibold tracking-tight">Thank you</h1>
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
	);
}

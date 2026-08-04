import { redirect } from "next/navigation";
import { CandidateShell } from "@/components/candidate/shell";
import { ConsentForm } from "@/components/consent-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { resolveToken } from "@/lib/auth-candidate";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Consent page — render only, no cookie writes (those happen in /a/[token]/route.ts).
 * PDPA 2010: names what is collected, who sees it, retention (spec §13.7 / UI §12.2).
 */
export default async function ConsentPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const candidate = await resolveToken(token);
	if (!candidate) redirect(`/a/${token}/done`);
	if (candidate.status === "STARTED") redirect(`/a/${token}/assessment`);

	return (
		<CandidateShell>
			<main className="mx-auto max-w-xl px-4 py-6 pb-24">
				<h1 className="text-xl font-semibold tracking-tight">
					Before you begin
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Hello {candidate.fullName},
				</p>

				<Card className="mt-5 border-border/80 shadow-none">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">At a glance</CardTitle>
						<CardDescription>What to expect before you start.</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
							<li>34 short statements about how you work</li>
							<li>About 12 minutes</li>
							<li>
								<strong className="font-medium text-foreground">
									No right or wrong answers
								</strong>{" "}
								— not a pass/fail test
							</li>
							<li>Your answers save as you go</li>
						</ul>
					</CardContent>
				</Card>

				<div className="mt-6 space-y-5 text-sm leading-relaxed">
					<section>
						<h2 className="font-medium text-foreground">Purpose</h2>
						<p className="mt-1.5 text-muted-foreground">
							This is a short self-assessment about how you work. Hiring teams
							use it as one structured input alongside the rest of your
							application.
						</p>
					</section>

					<section>
						<h2 className="font-medium text-foreground">What we collect</h2>
						<p className="mt-1.5 text-muted-foreground">
							Your name and email address, your answer to each of the 34
							statements, and how long you spend on each one.
						</p>
					</section>

					<section>
						<h2 className="font-medium text-foreground">Who sees it</h2>
						<p className="mt-1.5 text-muted-foreground">
							Only the hiring team for this role. Your answers are not shared
							outside this organisation.
						</p>
					</section>

					<section>
						<h2 className="font-medium text-foreground">How long we keep it</h2>
						<p className="mt-1.5 text-muted-foreground">
							Responses are kept for {env.RETENTION_DAYS} days from the date you
							submit them, then deleted. You may ask us to delete them sooner by
							replying to the invitation email.
						</p>
					</section>
				</div>

				<ConsentForm token={token} />
			</main>
		</CandidateShell>
	);
}

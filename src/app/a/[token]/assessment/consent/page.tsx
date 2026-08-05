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
import { currentAssignmentId, resolveAssignmentToken } from "@/lib/auth-candidate";
import { env } from "@/lib/env";
import { orderedAnswerableItems } from "@/lib/instrument-document";
import { loadVersionDocument } from "@/lib/version-document";

export const dynamic = "force-dynamic";

/**
 * Consent page — render only, no cookie writes (those happen in /a/[token]/route.ts).
 * Copy is version-driven (D18): intro, consent text, and estimated time come from the
 * assignment's frozen assessment version document, not hardcoded Core v1 copy.
 * PDPA 2010: names what is collected, who sees it, retention (spec §13.7 / UI §12.2).
 */
export default async function ConsentPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const assignment = await resolveAssignmentToken(token);
	if (!assignment) redirect(`/a/${token}/done`);

	// D8: the token and the cookie must agree on which assignment this browser holds.
	const cookieAssignmentId = await currentAssignmentId();
	if (cookieAssignmentId !== assignment.id) {
		// Re-enter through the token gate so a missing/stale cookie is re-minted.
		redirect(`/a/${token}`);
	}

	if (assignment.status === "STARTED") redirect(`/a/${token}/assessment`);

	const doc = await loadVersionDocument(assignment.assessmentVersionId);
	const itemCount = orderedAnswerableItems(doc).length;
	const retention = doc.consent.retention.replace(
		"{RETENTION_DAYS}",
		String(env.RETENTION_DAYS),
	);

	return (
		<CandidateShell>
			<main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-6 pb-24 outline-none">
				<h1 className="text-xl font-semibold tracking-tight">
					Before you begin
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Hello {assignment.candidate.fullName},
				</p>

				<Card className="mt-5 border-border/80 shadow-none">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">At a glance</CardTitle>
						<CardDescription>What to expect before you start.</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
							<li>{doc.candidateIntroduction}</li>
							<li>
								{itemCount} short statement{itemCount === 1 ? "" : "s"} about
								how you work
							</li>
							<li>About {doc.estimatedMinutes} minutes</li>
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
						<p className="mt-1.5 text-muted-foreground">{doc.consent.purpose}</p>
					</section>

					<section>
						<h2 className="font-medium text-foreground">What we collect</h2>
						<p className="mt-1.5 text-muted-foreground">
							{doc.consent.whatWeCollect}
						</p>
					</section>

					<section>
						<h2 className="font-medium text-foreground">Who sees it</h2>
						<p className="mt-1.5 text-muted-foreground">{doc.consent.whoSeesIt}</p>
					</section>

					<section>
						<h2 className="font-medium text-foreground">How long we keep it</h2>
						<p className="mt-1.5 text-muted-foreground">{retention}</p>
					</section>
				</div>

				<ConsentForm token={token} />
			</main>
		</CandidateShell>
	);
}

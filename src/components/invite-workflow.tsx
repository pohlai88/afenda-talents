import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
	{
		n: "1",
		title: "Add candidate details",
		body: "Enter one person, or paste many as Name, email.",
	},
	{
		n: "2",
		title: "Review invitation",
		body: "Check names and addresses. Invalid and already-invited rows stay out of the send.",
	},
	{
		n: "3",
		title: "Send personal links",
		body: "Each person gets their own one-time link. Resending replaces the old link.",
	},
] as const;

/**
 * Three-step invite explainer (requirements §9.2A).
 */
export function InviteWorkflow({
	ttlDays,
	assessmentMinutes = 12,
}: {
	ttlDays: number;
	assessmentMinutes?: number;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">How invitations work</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<ol className="grid gap-4 sm:grid-cols-3">
					{STEPS.map((step) => (
						<li key={step.n} className="flex flex-col gap-1">
							<span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
								Step {step.n}
							</span>
							<span className="text-sm font-medium">{step.title}</span>
							<span className="text-sm text-muted-foreground">{step.body}</span>
						</li>
					))}
				</ol>
				<ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
					<li>The assessment takes about {assessmentMinutes} minutes.</li>
					<li>
						Links expire after {ttlDays} day{ttlDays === 1 ? "" : "s"}.
					</li>
					<li>Links are personal — there are no candidate accounts.</li>
					<li>Resending invalidates the previous link for that person.</li>
				</ul>
			</CardContent>
		</Card>
	);
}

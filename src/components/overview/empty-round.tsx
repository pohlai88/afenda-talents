import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty";
import { PlayCircleIcon } from "lucide-react";

const STEPS = [
	{
		title: "Add candidate details",
		body: "A name and an email for each person you want to assess.",
	},
	{
		title: "Review the invitation",
		body: "Preview the exact email each candidate receives before anything is sent.",
	},
	{
		title: "Send personal links",
		body: "Every candidate gets a one-time link that expires. No accounts, no passwords.",
	},
];

/**
 * The steps are numbered because they are a genuine sequence — you cannot send before
 * you add. Six zero-valued cards and an empty table would tell a first-time manager
 * nothing (requirements §6.3). Role-gated CTAs are composed by the caller.
 */
export function EmptyRound({ children }: { children?: ReactNode }) {
	return (
		<Empty className="border-border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<PlayCircleIcon />
				</EmptyMedia>
				<EmptyTitle>Start this hiring round</EmptyTitle>
				<EmptyDescription>
					Afenda Talents invites candidates to a short self-assessment and turns their answers
					into a five-dimension profile you can review.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex flex-col gap-6">
				<ol className="grid gap-4 sm:grid-cols-3">
					{STEPS.map((step, i) => (
						<li key={step.title} className="flex flex-col gap-1">
							<span className="font-mono text-xs text-muted-foreground tabular-nums">
								{String(i + 1).padStart(2, "0")}
							</span>
							<span className="text-sm font-medium">{step.title}</span>
							<span className="text-sm text-muted-foreground">{step.body}</span>
						</li>
					))}
				</ol>
				{children}
			</EmptyContent>
		</Empty>
	);
}

export function EmptyRoundAdminActions() {
	return (
		<div className="flex flex-wrap gap-2">
			<Button nativeButton={false} render={<Link href="/admin/invite" />}>
				Invite your first candidates
			</Button>
			<Button variant="outline" nativeButton={false} render={<Link href="/admin/rounds" />}>
				Open a hiring round
			</Button>
		</div>
	);
}

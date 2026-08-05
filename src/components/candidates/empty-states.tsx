import type { ReactNode } from "react";
import Link from "next/link";
import { SearchX, FilterX, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

/**
 * Requirements §7.6 wants these three distinguishable, each with its own recovery
 * action — "no candidates at all" is a different problem from "your filter is too
 * narrow", and telling them apart is what stops a manager thinking the round is empty.
 *
 * Role-gated CTAs are composed by the caller (children), not an isAdmin boolean.
 */

/** Nobody has been invited at all — the round has not started. */
export function NoCandidates({ children }: { children?: ReactNode }) {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<UserPlus />
				</EmptyMedia>
				<EmptyTitle>No candidates invited yet</EmptyTitle>
				<EmptyDescription>
					Invite candidates by email. Each one receives a personal link that expires, and their
					profile appears here once they submit.
				</EmptyDescription>
			</EmptyHeader>
			{children}
		</Empty>
	);
}

export function InviteCandidatesAction() {
	return (
		<EmptyContent>
			<Button nativeButton={false} render={<Link href="/admin/invite" />}>
				Invite candidates
			</Button>
		</EmptyContent>
	);
}

/** People exist, but none match the current filters. */
export function NoFilterMatch() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FilterX />
				</EmptyMedia>
				<EmptyTitle>No candidates match these filters</EmptyTitle>
				<EmptyDescription>
					Nobody in this round is at that stage right now. Clear the filters to see everyone.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
					Clear filters
				</Button>
			</EmptyContent>
		</Empty>
	);
}

/** People exist, but the search term found nobody. */
export function NoSearchMatch({ term }: { term: string }) {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchX />
				</EmptyMedia>
				<EmptyTitle>Nothing matches “{term}”</EmptyTitle>
				<EmptyDescription>
					Search looks at names and email addresses. Check the spelling, or try part of the
					address.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
					Show all candidates
				</Button>
			</EmptyContent>
		</Empty>
	);
}

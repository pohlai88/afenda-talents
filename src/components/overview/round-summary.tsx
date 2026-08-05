import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/relative-time";

/**
 * Overview header. Shared "View all candidates" stays here; role-gated actions are
 * composed by the caller as children (no isAdmin boolean).
 */
export function RoundSummary({
	firstName,
	total,
	ready,
	needsAttention,
	lastActivityAt,
	now,
	children,
}: {
	firstName: string;
	total: number;
	ready: number;
	needsAttention: number;
	lastActivityAt: Date | null;
	now: Date;
	children?: ReactNode;
}) {
	const sentence = [
		`${total} candidate${total === 1 ? "" : "s"} in this hiring round`,
		ready > 0 ? `${ready} ready for review` : null,
		needsAttention > 0 ? `${needsAttention} needing follow-up` : null,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<PageHeader
			eyebrow="Hiring overview"
			title={`Welcome back, ${firstName}`}
			description={`${sentence}.`}
			meta={
				lastActivityAt && (
					<span className="text-muted-foreground">
						Last activity {relativeTime(lastActivityAt, now)}
					</span>
				)
			}
			actions={
				<>
					<Button
						variant="outline"
						nativeButton={false}
						render={<Link href="/admin/candidates" />}
					>
						View all candidates
					</Button>
					{children}
				</>
			}
		/>
	);
}

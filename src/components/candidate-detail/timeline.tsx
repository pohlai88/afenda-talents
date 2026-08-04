import type { TimelineEvent } from "@/lib/candidate-timeline";
import { cn } from "@/lib/utils";

/**
 * Vertical activity list for a single candidate (requirements §8.7, §14.9).
 * Readable labels and times only — never tokens.
 */
export function CandidateTimeline({
	events,
	className,
}: {
	events: TimelineEvent[];
	className?: string;
}) {
	if (events.length === 0) {
		return (
			<p className={cn("text-sm text-muted-foreground", className)}>
				No activity recorded yet.
			</p>
		);
	}

	return (
		<ol className={cn("relative space-y-0 border-l border-border", className)}>
			{events.map((event) => (
				<li key={event.id} className="relative pb-6 pl-6 last:pb-0">
					<span
						className="absolute top-1.5 -left-[5px] size-2.5 rounded-full bg-primary ring-4 ring-background"
						aria-hidden
					/>
					<p className="text-sm font-medium">{event.label}</p>
					<time
						dateTime={event.at.toISOString()}
						className="text-xs text-muted-foreground tabular-nums"
					>
						{event.at.toLocaleString("en-GB", {
							day: "2-digit",
							month: "short",
							year: "numeric",
							hour: "2-digit",
							minute: "2-digit",
						})}
					</time>
				</li>
			))}
		</ol>
	);
}

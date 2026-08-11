import { StatusBadge } from "@/components/status-badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { STAGE_EXPLANATION, statusDisplay } from "@/lib/status-display";
import type { Status } from "@/lib/status-constants";

/**
 * Progress view when there is no scored profile yet (requirements §8.2 progress path).
 * Explains where the candidate is without inventing scores.
 *
 * `totalItems` must come from the assignment’s published instrument (answerable
 * items only) — never a hardcoded Core v1 length.
 */
export function CandidateProgressPanel({
	status,
	answeredCount,
	totalItems,
}: {
	status: Status;
	answeredCount: number;
	totalItems: number;
}) {
	const { label } = statusDisplay(status);
	const explanation =
		status in STAGE_EXPLANATION
			? STAGE_EXPLANATION[status as keyof typeof STAGE_EXPLANATION]
			: undefined;
	const showCount = status === "STARTED" || status === "SUBMITTED";
	const safeTotal = Math.max(totalItems, 1);
	const clampedAnswered = Math.min(Math.max(answeredCount, 0), safeTotal);
	const progressLabel = `${clampedAnswered} of ${totalItems} items answered`;
	const progressPct =
		totalItems > 0 ? Math.round((clampedAnswered / totalItems) * 100) : 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Progress</CardTitle>
				<CardDescription>
					This candidate has not finished a reviewable profile yet.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center gap-3">
					<StatusBadge status={status} />
					<span className="text-sm text-muted-foreground">{label}</span>
				</div>
				{explanation && (
					<p className="text-sm text-muted-foreground">{explanation}</p>
				)}
				{showCount && (
					<div className="space-y-2">
						<div
							role="progressbar"
							aria-valuemin={0}
							aria-valuemax={totalItems}
							aria-valuenow={clampedAnswered}
							aria-valuetext={progressLabel}
							aria-label="Assessment progress"
							className="h-1.5 overflow-hidden rounded-full bg-muted"
						>
							<div
								className="h-full rounded-full bg-progress transition-[width] duration-300 motion-reduce:transition-none"
								style={{ width: `${progressPct}%` }}
								aria-hidden
							/>
						</div>
						<p className="text-sm tabular-nums">
							<span className="font-medium">
								{clampedAnswered} of {totalItems}
							</span>{" "}
							items answered
						</p>
					</div>
				)}
				{status === "EXPIRED" || status === "REVOKED" ? (
					<p className="text-sm text-muted-foreground">
						Their invitation link no longer works. An administrator can resend a
						fresh link when appropriate.
					</p>
				) : null}
				{status === "SENT" ? (
					<p className="text-sm text-muted-foreground">
						Waiting for the candidate to open their personal link.
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

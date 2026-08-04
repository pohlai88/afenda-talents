import { StatusBadge } from "@/components/status-badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { STAGE_EXPLANATION, statusDisplay } from "@/lib/status-display";

const TOTAL_ITEMS = 34;

/**
 * Progress view when there is no scored profile yet (requirements §8.2 progress path).
 * Explains where the candidate is without inventing scores.
 */
export function CandidateProgressPanel({
	status,
	answeredCount,
}: {
	status: string;
	answeredCount: number;
}) {
	const { label } = statusDisplay(status);
	const explanation = STAGE_EXPLANATION[status];
	const showCount = status === "STARTED" || status === "SUBMITTED";

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
					<p className="text-sm tabular-nums">
						<span className="font-medium">
							{answeredCount} of {TOTAL_ITEMS}
						</span>{" "}
						items answered
					</p>
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

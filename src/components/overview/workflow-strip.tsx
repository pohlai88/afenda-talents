import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Status } from "@/lib/status-constants";
import {
  STAGE_EXPLANATION,
  WORKFLOW_STAGES,
  statusDisplay,
} from "@/lib/status-display";
import { withRound } from "@/lib/round-context";

/**
 * Current-state distribution only. Each assignment appears once in its present stage;
 * no conversion or candidate-quality inference is made.
 */
export function WorkflowStrip({
  counts,
  exceptions,
  roundId,
}: {
  counts: Partial<Record<Status, number>>;
  exceptions: { status: Status; count: number }[];
  roundId?: string | null;
}) {
  const base = WORKFLOW_STAGES.reduce(
    (sum, stage) => sum + (counts[stage] ?? 0),
    0,
  );
  const activeExceptions = exceptions.filter((exception) => exception.count > 0);

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b bg-surface-subtle py-4">
        <div className="space-y-1">
          <h2 id="workflow-heading" className="text-base font-semibold">
            Current workflow state
          </h2>
          <p className="text-sm text-muted-foreground">
            Where candidates are now in this hiring round.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {WORKFLOW_STAGES.map((stage, index) => {
            const count = counts[stage] ?? 0;
            const percent = base === 0 ? 0 : Math.round((count / base) * 100);
            const statusInfo = statusDisplay(stage);
            const href = withRound(
              `/admin/candidates?status=${stage}`,
              roundId,
            );
            return (
              <Link
                key={stage}
                href={href}
                className="group relative min-w-0 border-b p-5 outline-none transition-colors hover:bg-muted/45 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
              >
                <span className="mb-4 flex items-center justify-between gap-3">
                  <span className="font-mono text-[0.625rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                    Stage {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {percent}%
                  </span>
                </span>
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                    {statusInfo.label}
                  </span>
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">
                    {count}
                  </span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {STAGE_EXPLANATION[stage]}
                </span>
              </Link>
            );
          })}
        </div>

        {activeExceptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-attention/5 px-5 py-3 text-xs">
            <span className="font-medium text-attention">Outside active workflow</span>
            {activeExceptions.map((exception) => (
              <Link
                key={exception.status}
                href={withRound(
                  `/admin/candidates?status=${exception.status}`,
                  roundId,
                )}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <span className="font-medium tabular-nums">{exception.count}</span>{" "}
                {statusDisplay(exception.status).label.toLowerCase()}
              </Link>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

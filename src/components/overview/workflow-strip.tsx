import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/status-constants";
import { STAGE_EXPLANATION, WORKFLOW_STAGES, statusDisplay } from "@/lib/status-display";

/**
 * Current-state distribution: each candidate is counted once, under the stage matching
 * their present status. Not a conversion funnel — no stage-transition history is stored,
 * so "ever reached this stage" is unknowable and is not claimed.
 */
export function WorkflowStrip({
  counts,
  exceptions,
}: {
  counts: Partial<Record<Status, number>>;
  exceptions: { status: Status; count: number }[];
}) {
  const base = WORKFLOW_STAGES.reduce((sum, stage) => sum + (counts[stage] ?? 0), 0);
  const activeExceptions = exceptions.filter((e) => e.count > 0);

  return (
    <section aria-labelledby="workflow-heading" className="flex flex-col gap-3">
      <h2 id="workflow-heading" className="text-sm font-medium">
        Where candidates are now
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WORKFLOW_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          const percent = base === 0 ? 0 : Math.round((count / base) * 100);
          const statusInfo = statusDisplay(stage);
          return (
            <Link key={stage} href={`/admin/candidates?status=${stage}`} className="group">
              <Card className="h-full transition-colors hover:border-ring group-focus-visible:border-ring">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium group-hover:underline underline-offset-4">
                      {statusInfo.label}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {percent}%
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums">{count}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      of {base}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{STAGE_EXPLANATION[stage]}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      {activeExceptions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Outside the round:{" "}
          {activeExceptions.map((e, i) => (
            <span key={e.status}>
              {i > 0 && " · "}
              <Link
                href={`/admin/candidates?status=${e.status}`}
                className="underline underline-offset-4"
              >
                <span className="tabular-nums">{e.count}</span>{" "}
                {statusDisplay(e.status).label.toLowerCase()}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

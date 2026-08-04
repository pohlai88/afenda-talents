import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
  counts: Record<string, number>;
  exceptions: { status: string; count: number }[];
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
          return (
            <Card key={stage} className="transition-colors hover:border-ring">
              <CardContent className="flex flex-col gap-1">
                <Link
                  href={`/admin/candidates?status=${stage}`}
                  className="text-sm font-medium underline-offset-4 hover:underline focus-visible:underline"
                >
                  {statusDisplay(stage).label}
                </Link>
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{count}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {percent}% of {base}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{STAGE_EXPLANATION[stage]}</p>
              </CardContent>
            </Card>
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

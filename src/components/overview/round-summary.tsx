import type { ReactNode } from "react";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/relative-time";
import { withRound } from "@/lib/round-context";

export function RoundSummary({
  firstName,
  total,
  ready,
  needsAttention,
  lastActivityAt,
  now,
  roundId,
  children,
}: {
  firstName: string;
  total: number;
  ready: number;
  needsAttention: number;
  lastActivityAt: Date | null;
  now: Date;
  roundId?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="Hiring overview"
        title={`Welcome back, ${firstName}`}
        description="Current round status, follow-up work, completed profiles, and recent activity in one operational view."
        meta={
          lastActivityAt ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-3.5" />
              Last activity {relativeTime(lastActivityAt, now)}
            </span>
          ) : (
            <span className="text-muted-foreground">No round activity yet</span>
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href={withRound("/admin/candidates", roundId)} />
              }
            >
              View candidates
            </Button>
            {children}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          label="Candidates"
          value={total}
          description="Assigned to this round"
        />
        <SummaryMetric
          label="Ready for review"
          value={ready}
          description="Completed profiles"
          emphasis="progress"
        />
        <SummaryMetric
          label="Needs follow-up"
          value={needsAttention}
          description="Operational attention items"
          emphasis={needsAttention > 0 ? "attention" : "neutral"}
        />
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  description,
  emphasis = "neutral",
}: {
  label: string;
  value: number;
  description: string;
  emphasis?: "neutral" | "progress" | "attention";
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-end justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <span
          className={
            emphasis === "progress"
              ? "text-progress"
              : emphasis === "attention"
                ? "text-attention"
                : "text-foreground"
          }
        >
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
        </span>
      </CardContent>
    </Card>
  );
}

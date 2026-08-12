import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UiDimension } from "@/lib/result-display";
import { withRound } from "@/lib/round-context";

export type CompletedProfile = {
  id: string;
  fullName: string;
  submittedAt: Date | null;
  dimensions: UiDimension[];
  contextCount: number;
};

/**
 * Five separate dimension readings. There is no total, rank, ordering by score, or
 * colour encoding of candidate quality.
 */
function DimensionReadings({ dimensions }: { dimensions: UiDimension[] }) {
  return (
    <dl className="grid grid-cols-5 gap-2" aria-label="Dimension readings">
      {dimensions.map((dimension) => (
        <div key={dimension.code} className="min-w-0">
          <dt className="font-mono text-[0.625rem] font-medium tracking-[0.08em] text-muted-foreground">
            {dimension.code}
          </dt>
          <dd className="mt-1 space-y-1.5">
            <span className="block text-sm font-medium tabular-nums">
              {dimension.scaled}
            </span>
            <span className="block h-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-chart-5"
                style={{
                  width: `${Math.max(0, Math.min(100, dimension.scaled))}%`,
                }}
              />
            </span>
            <span className="sr-only">{dimension.band} band</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RecentCompletions({
  profiles,
  roundId,
}: {
  profiles: CompletedProfile[];
  roundId?: string | null;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="border-b bg-surface-subtle">
        <CardTitle id="completions-heading">Recently completed</CardTitle>
        <CardDescription>
          Separate dimension readings for human review. No overall score or ranking is
          produced.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {profiles.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <CheckCircle2 aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No completed profiles yet</p>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              Completed candidate assessments will appear here when a profile is ready
              for review.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="grid min-w-0 gap-4 px-5 py-5 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.3fr)_auto] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-10 border">
                    <AvatarFallback className="text-xs font-semibold">
                      {profile.fullName
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((name) => name[0]?.toUpperCase())
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {profile.fullName}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Completed {profile.submittedAt?.toLocaleDateString("en-GB") ?? "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {profile.contextCount === 0
                        ? "No response-context indicators"
                        : `${profile.contextCount} of 4 context indicators to review`}
                    </p>
                  </div>
                </div>
                <DimensionReadings dimensions={profile.dimensions} />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit lg:justify-self-end"
                  nativeButton={false}
                  render={
                    <Link
                      href={withRound(
                        `/admin/candidate/${profile.id}`,
                        roundId,
                      )}
                    />
                  }
                >
                  Review profile
                  <ArrowUpRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

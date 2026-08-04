import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DimensionScore } from "@/lib/scoring";

export type CompletedProfile = {
  id: string;
  fullName: string;
  submittedAt: Date | null;
  dimensions: DimensionScore[];
  contextCount: number;
};

/**
 * Five separate dimension readings — never a total, a rank, or an ordering by score
 * (build-skill invariant 9). Colour encodes nothing: every bar uses the same neutral
 * tone, and the value and band are text, so the meaning survives greyscale printing
 * and colour-blind readers alike.
 */
function DimensionPips({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {dimensions.map((d) => (
        <li key={d.code} className="min-w-14">
          <span className="sr-only">
            {d.code}: {d.scaled} out of 100, {d.band} band.
          </span>
          <span aria-hidden="true" className="block font-mono text-[10px] text-muted-foreground">
            {d.code}
          </span>
          <span aria-hidden="true" className="mt-1 block h-1 w-full rounded-full bg-muted">
            <span
              className="block h-1 rounded-full bg-chart-5"
              style={{ width: `${Math.max(0, Math.min(100, d.scaled))}%` }}
            />
          </span>
          <span aria-hidden="true" className="mt-1 block text-xs tabular-nums">
            {d.scaled}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RecentCompletions({ profiles }: { profiles: CompletedProfile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently completed</CardTitle>
        <CardDescription>
          Five dimensions per candidate. There is no overall score and no ranking — each
          profile is one input into a hiring decision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No completed assessments yet.</p>
        ) : (
          <ul className="divide-y">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-end justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Completed {p.submittedAt?.toLocaleDateString("en-GB") ?? "—"} ·{" "}
                    {p.contextCount === 0
                      ? "no response-context indicators"
                      : `${p.contextCount} of 4 response-context indicators to review`}
                  </p>
                  <div className="mt-3">
                    <DimensionPips dimensions={p.dimensions} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/admin/candidate/${p.id}`} />}
                >
                  Review profile
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

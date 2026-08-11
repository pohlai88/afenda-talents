import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttentionItem, WorkspaceAttentionItem } from "@/lib/attention";
import { relativeTime, untilTime } from "@/lib/relative-time";
import { withRound } from "@/lib/round-context";

/**
 * Prioritised operational queue only. Ordering and emphasis are based on workflow
 * urgency, never candidate answers or score values.
 */
export function HiringAttention({
  items,
  now,
  roundId,
}: {
  items: AttentionItem[];
  now: Date;
  roundId?: string | null;
}) {
  return (
    <Card className="h-full shadow-none">
      <CardHeader className="border-b bg-surface-subtle">
        <CardTitle id="attention-heading">Needs attention</CardTitle>
        <CardDescription>
          Human follow-up only. Afenda does not take these actions automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <CheckCircle2 aria-hidden="true" className="size-6 text-progress" />
            <p className="text-sm font-medium">Nothing needs follow-up</p>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground">
              There are no expiring invitations, stalled assessments, or completed
              profiles waiting for review.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const candidateHref =
                item.kind === "awaiting-review"
                  ? `/admin/candidate/${item.assignmentId}`
                  : "/admin/candidates";
              return (
                <li
                  key={`${item.kind}-${item.assignmentId}`}
                  className="flex min-w-0 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-medium">{item.fullName}</h3>
                      <Badge
                        variant="outline"
                        className={
                          item.kind === "expiring"
                            ? "border-attention/35 bg-attention/8 text-attention"
                            : "border-progress/30 bg-progress/8 text-progress"
                        }
                      >
                        {item.kind === "expiring" ? "Time-sensitive" : "Review"}
                      </Badge>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground">{item.reason}</span>
                      {" · "}
                      {item.kind === "expiring"
                        ? untilTime(item.since, now)
                        : relativeTime(item.since, now)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    nativeButton={false}
                    render={<Link href={withRound(candidateHref, roundId)} />}
                  >
                    {item.kind === "awaiting-review" ? "Review profile" : "Open candidate"}
                    <ArrowUpRight aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkspaceAttention({ items }: { items: WorkspaceAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="shadow-none">
      <CardHeader className="border-b bg-surface-subtle">
        <CardTitle id="workspace-heading">Workspace administration</CardTitle>
        <CardDescription>Access and account housekeeping.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={item.userId}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-medium">{item.name}</h3>
                  <Badge variant="outline">Admin</Badge>
                </div>
                <p className="text-xs leading-5 text-attention">{item.reason}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/users" />}
              >
                Open hiring team
                <ArrowUpRight aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

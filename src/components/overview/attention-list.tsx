import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionItem, WorkspaceAttentionItem } from "@/lib/attention";
import { relativeTime, untilTime } from "@/components/overview/round-summary";

/**
 * A prioritised queue of things a person must decide about, ordered by operational
 * urgency alone — never by anything about a candidate's answers.
 */
export function HiringAttention({ items, now }: { items: AttentionItem[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>
          Nothing here is sent automatically. Each item is a decision for a person.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nothing needs following up right now.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.candidateId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-attention">{item.reason}</span>
                    {" · "}
                    {item.kind === "expiring"
                      ? untilTime(item.since, now)
                      : relativeTime(item.since, now)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={
                        item.kind === "awaiting-review"
                          ? `/admin/candidate/${item.candidateId}`
                          : "/admin/candidates"
                      }
                    />
                  }
                >
                  {item.kind === "awaiting-review" ? "Review profile" : "Open candidate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Kept separate from hiring attention so the hiring workflow stays legible. */
export function WorkspaceAttention({ items }: { items: WorkspaceAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Access and account housekeeping.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={item.userId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-attention">{item.reason}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/users" />}
              >
                Open team
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

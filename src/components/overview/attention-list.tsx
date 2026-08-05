import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import type { AttentionItem, WorkspaceAttentionItem } from "@/lib/attention";
import { relativeTime, untilTime } from "@/lib/relative-time";

/**
 * A prioritised queue of things a person must decide about, ordered by operational
 * urgency alone — never by anything about a candidate's answers.
 */
export function HiringAttention({ items, now }: { items: AttentionItem[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle id="attention-heading">Needs your attention</CardTitle>
        <CardDescription>
          Nothing here is sent automatically. Each item is a decision for a person.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyDescription className="py-4">
            Nothing needs following up right now.
          </EmptyDescription>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.assignmentId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="truncate text-sm font-medium">{item.fullName}</h3>
                    <Badge 
                      variant={item.kind === "expiring" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {item.kind === "expiring" ? "Urgent" : "Review"}
                    </Badge>
                  </div>
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
                          ? `/admin/candidate/${item.assignmentId}`
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
        <CardTitle id="workspace-heading">Workspace</CardTitle>
        <CardDescription>Access and account housekeeping.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={item.userId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="truncate text-sm font-medium">{item.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    Admin
                  </Badge>
                </div>
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyDescription } from "@/components/ui/empty";
import { relativeTime } from "@/lib/relative-time";

export type ActivityEntry = { id: string; sentence: string; at: Date };

export function ActivityFeed({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle id="activity-heading">Recent activity</CardTitle>
        <CardDescription>What has happened in this round.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyDescription className="py-4">
            Nothing has happened yet.
          </EmptyDescription>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm">{entry.sentence}</span>
                <span className="text-xs text-muted-foreground">{relativeTime(entry.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

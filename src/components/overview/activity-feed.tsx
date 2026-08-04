import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/components/overview/round-summary";

export type ActivityEntry = { id: string; sentence: string; at: Date };

export function ActivityFeed({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>What has happened in this round.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nothing has happened yet.</p>
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

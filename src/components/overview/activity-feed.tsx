import { Activity, Circle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { relativeTime } from "@/lib/relative-time";

export type ActivityEntry = { id: string; sentence: string; at: Date };

export function ActivityFeed({
  entries,
  now,
}: {
  entries: ActivityEntry[];
  now: Date;
}) {
  return (
    <Card className="h-full shadow-none">
      <CardHeader className="border-b bg-surface-subtle">
        <CardTitle id="activity-heading">Recent activity</CardTitle>
        <CardDescription>Recorded workflow events in this round.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <Activity aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No activity recorded</p>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground">
              Invitations, candidate progress, profile reviews, and exports will appear
              here when they occur.
            </p>
          </div>
        ) : (
          <ol className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex gap-3 px-5 py-4">
                <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
                  <Circle
                    aria-hidden="true"
                    className="size-2 fill-progress text-progress"
                  />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm leading-5">{entry.sentence}</p>
                  <time
                    dateTime={entry.at.toISOString()}
                    className="block text-xs text-muted-foreground"
                  >
                    {relativeTime(entry.at, now)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

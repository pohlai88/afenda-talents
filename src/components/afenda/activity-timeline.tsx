import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type AfendaActivityItem = {
  id: string;
  title: string;
  timestamp: string;
  actor?: string | null;
  context?: string | null;
  detail?: string | null;
};

export function AfendaActivityTimeline({
  items,
  title = "Activity",
  description = "Recent recorded actions for this operational record.",
  emptyText = "No recorded activity yet.",
}: {
  items: AfendaActivityItem[];
  title?: string;
  description?: string;
  emptyText?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="flex flex-col">
            {items.map((item, index) => (
              <li key={item.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                    <History aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.actor ? `By ${item.actor} · ` : ""}{item.timestamp}
                        </p>
                      </div>
                      {item.context ? <Badge variant="outline">{item.context}</Badge> : null}
                    </div>
                    {item.detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

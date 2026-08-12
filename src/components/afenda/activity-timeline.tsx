"use client";

import { ChevronDown, ChevronUp, History } from "lucide-react";
import { useMemo, useState } from "react";

import { AfendaEmptyState } from "@/components/afenda/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type AfendaActivityItem = {
  id: string;
  title: string;
  timestamp: string;
  actor?: string | null;
  context?: string | null;
  detail?: string | null;
  metadata?: { label: string; value: string }[];
};

export function AfendaActivityTimeline({
  items,
  title = "Activity",
  description = "Recent recorded actions for this operational record.",
  emptyText = "No recorded activity yet.",
  initialCount = 8,
}: {
  items: AfendaActivityItem[];
  title?: string;
  description?: string;
  emptyText?: string;
  initialCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const visibleItems = useMemo(
    () => showAll ? items : items.slice(0, initialCount),
    [initialCount, items, showAll],
  );

  function toggleItem(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <AfendaEmptyState title="No activity recorded" description={emptyText} compact />
        ) : (
          <>
            <ol className="flex flex-col">
              {visibleItems.map((item, index) => {
                const detailsAvailable = Boolean(item.detail) || Boolean(item.metadata?.length);
                const itemExpanded = expanded.has(item.id);
                return (
                  <li key={item.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_5rem]">
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
                          <div className="flex items-center gap-1">
                            {item.context ? <Badge variant="outline">{item.context}</Badge> : null}
                            {detailsAvailable ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-expanded={itemExpanded}
                                aria-controls={`activity-detail-${item.id}`}
                                onClick={() => toggleItem(item.id)}
                              >
                                {itemExpanded ? <ChevronUp data-icon="inline-start" aria-hidden="true" /> : <ChevronDown data-icon="inline-start" aria-hidden="true" />}
                                {itemExpanded ? "Hide" : "Details"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {detailsAvailable && itemExpanded ? (
                          <div id={`activity-detail-${item.id}`} className="mt-3 rounded-lg border bg-muted/20 p-3">
                            {item.detail ? <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p> : null}
                            {item.metadata?.length ? (
                              <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                                {item.metadata.map((entry) => (
                                  <div key={`${item.id}-${entry.label}`} className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{entry.label}</dt>
                                    <dd className="mt-0.5 break-words text-sm font-medium">{entry.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {items.length > initialCount ? (
              <div className="mt-4 border-t pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
                  {showAll ? "Show recent only" : `Show all ${items.length} events`}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

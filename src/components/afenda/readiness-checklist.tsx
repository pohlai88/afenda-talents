import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AfendaReadinessItem = {
  label: string;
  detail?: string;
  state: "ready" | "attention" | "optional";
};

export function AfendaReadinessChecklist({
  title = "Readiness",
  description = "Check what is complete and what still needs attention before the next lifecycle step.",
  items,
  className,
}: {
  title?: string;
  description?: string;
  items: AfendaReadinessItem[];
  className?: string;
}) {
  const requiredItems = items.filter((item) => item.state !== "optional");
  const ready = requiredItems.filter((item) => item.state === "ready").length;
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums">{ready}/{requiredItems.length}</p>
            <p className="text-xs text-muted-foreground">required ready</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => {
            const Icon = item.state === "ready" ? CheckCircle2 : item.state === "attention" ? CircleAlert : CircleDashed;
            return (
              <li key={item.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    item.state === "ready" && "text-emerald-600 dark:text-emerald-400",
                    item.state === "attention" && "text-amber-600 dark:text-amber-400",
                    item.state === "optional" && "text-muted-foreground",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.detail ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

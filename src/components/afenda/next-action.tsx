import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AfendaNextAction({
  title = "Next action",
  action,
  why,
  who,
  children,
  tone = "default",
  className,
}: {
  title?: string;
  action: string;
  why: string;
  who?: string;
  children?: ReactNode;
  tone?: "default" | "attention" | "complete";
  className?: string;
}) {
  return (
    <Card
      role="region"
      aria-label={title}
      className={cn(
        tone === "attention" && "border-amber-500/30 bg-amber-500/[0.035]",
        tone === "complete" && "border-emerald-500/25 bg-emerald-500/[0.03]",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <dl className="grid gap-3">
          <div>
            <dt className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Do this</dt>
            <dd className="mt-1 text-sm font-medium leading-6">{action}</dd>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Why</dt>
              <dd className="mt-1 text-sm leading-6 text-muted-foreground">{why}</dd>
            </div>
            {who ? (
              <div>
                <dt className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Who</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{who}</dd>
              </div>
            ) : null}
          </div>
        </dl>
        {children ? <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

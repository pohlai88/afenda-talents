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
        <div className="grid gap-3">
          <div>
            <p className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Do this</p>
            <p className="mt-1 text-sm font-medium leading-6">{action}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Why</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{why}</p>
            </div>
            {who ? (
              <div>
                <p className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">Who</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{who}</p>
              </div>
            ) : null}
          </div>
        </div>
        {children ? <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

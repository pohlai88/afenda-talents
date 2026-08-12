import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AfendaMetricCard({
  label,
  value,
  href,
  description,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const card = (
    <Card className={cn("h-full transition-colors", href && "hover:bg-accent/40", className)}>
      <CardHeader className="gap-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          {icon ? <div className="shrink-0 text-muted-foreground" aria-hidden="true">{icon}</div> : null}
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{card}</Link> : card;
}

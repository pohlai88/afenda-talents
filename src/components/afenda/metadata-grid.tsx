import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AfendaMetadataItem = {
  label: string;
  value: ReactNode;
};

export function AfendaMetadataGrid({
  items,
  columns = 2,
  className,
}: {
  items: AfendaMetadataItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 xl:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

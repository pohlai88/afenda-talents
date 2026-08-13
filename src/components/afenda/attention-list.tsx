import Link from "next/link";
import type { ReactNode } from "react";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";

export type AfendaAttentionItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  meta?: ReactNode;
  status?: ReactNode;
};

export function AfendaAttentionList({
  items,
  emptyTitle = "Nothing needs attention",
  emptyDescription = "There are no open items in this queue.",
}: {
  items: AfendaAttentionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.id}>
          {index > 0 ? <Separator /> : null}
          <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={item.href} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {item.title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
            {(item.meta || item.status) ? (
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {item.meta}
                {item.status}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

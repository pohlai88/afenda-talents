import type { ReactNode } from "react";
import { CircleAlert, Inbox } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AfendaEmptyState({
  title,
  description,
  action,
  compact = false,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Empty className={cn("border border-dashed", compact && "p-5", className)}>
      <EmptyHeader>
        <Inbox aria-hidden="true" />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function AfendaErrorState({ title = "Something went wrong", description }: { title?: string; description: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

export function AfendaPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading Corporate Administration content.</span>
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-10 w-full" aria-hidden="true" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80 w-full" aria-hidden="true" />
    </div>
  );
}

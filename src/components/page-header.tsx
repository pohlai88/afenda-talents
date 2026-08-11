import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical admin title hierarchy: context, title, one-sentence purpose, optional
 * metadata, and page-level actions. Keeping this structure shared makes keyboard,
 * mobile, and visual hierarchy consistent across every operational surface.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex min-w-0 flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between lg:pb-7",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="font-mono text-[0.6875rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-[1.75rem] sm:leading-9">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-pretty text-muted-foreground sm:text-[0.9375rem]">
              {description}
            </p>
          ) : null}
        </div>
        {meta ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

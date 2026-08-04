import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The title hierarchy every admin page uses: eyebrow, title, one-sentence purpose,
 * optional metadata, actions on the right (requirements §4.3).
 *
 * Props plus ReactNode slots rather than a compound component with context: there are
 * five consumers, each rendering a title and at most two buttons.
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
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

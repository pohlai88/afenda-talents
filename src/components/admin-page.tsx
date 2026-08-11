import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const WIDTH = {
  fluid: "max-w-none",
  wide: "max-w-[90rem]",
  content: "max-w-6xl",
  narrow: "max-w-3xl",
} as const;

export function AdminPage({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
}) {
  return (
    <div
      data-slot="admin-page"
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-7 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8",
        WIDTH[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminSection({
  children,
  className,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      data-slot="admin-section"
      aria-labelledby={labelledBy}
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      {children}
    </section>
  );
}

export function AdminSectionHeader({
  id,
  title,
  description,
  actions,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="admin-section-header"
      className={cn(
        "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 id={id} className="text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function AdminToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="admin-toolbar"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

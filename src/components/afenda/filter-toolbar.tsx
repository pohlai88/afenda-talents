"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AfendaFilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  resultCount,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  resultCount?: number;
  children?: ReactNode;
}) {
  const resultLabel = typeof resultCount === "number"
    ? `${resultCount} result${resultCount === 1 ? "" : "s"}`
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between" role="search" aria-label="Filter records">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pr-10 pl-8"
            aria-label={searchPlaceholder.replace(/…$/, "")}
          />
          {search ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {resultLabel ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
            {resultLabel}
          </span>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2" aria-label="Filter options">{children}</div> : null}
    </div>
  );
}

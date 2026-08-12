import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AfendaPageFrame({
  children,
  width = "wide",
  className,
  reserveMobileActions = false,
}: {
  children: ReactNode;
  width?: "wide" | "record" | "form" | "compact";
  className?: string;
  reserveMobileActions?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-6 p-4 sm:p-6",
        width === "wide" && "max-w-7xl",
        width === "record" && "max-w-6xl",
        width === "form" && "max-w-5xl",
        width === "compact" && "max-w-3xl",
        reserveMobileActions && "pb-28 sm:pb-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

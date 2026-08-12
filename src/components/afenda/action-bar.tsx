import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AfendaActionBar({
  children,
  label = "Record actions",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <>
      <div aria-hidden="true" className="h-20 sm:hidden" />
      <div
        aria-label={label}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-20px_rgba(15,29,40,0.45)] backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none",
          className,
        )}
        role="group"
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-2 sm:flex sm:max-w-none sm:flex-wrap">
          {children}
        </div>
      </div>
    </>
  );
}

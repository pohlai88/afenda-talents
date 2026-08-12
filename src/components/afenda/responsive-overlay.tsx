"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MOBILE_QUERY = "(max-width: 639px)";

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function AfendaResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
}) {
  const mobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerSnapshot);
  const accessibleDescription = description ?? `Complete the ${title.toLowerCase()} task, then save or close this panel.`;

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={cn("max-h-[92dvh] rounded-t-xl", contentClassName)}>
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className={description ? undefined : "sr-only"}>{accessibleDescription}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? <SheetFooter className="border-t bg-muted/50">{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>{accessibleDescription}</DialogDescription>
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

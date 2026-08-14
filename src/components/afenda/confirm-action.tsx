"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmCallback = () => unknown | Promise<unknown>;

export function AfendaConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  destructive = false,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: ConfirmCallback;
  busy?: boolean;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AfendaConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  disabled = false,
  destructive = false,
  variant = "outline",
  size = "sm",
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: ConfirmCallback;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}) {
  return (
    <AfendaConfirmAction
      trigger={<Button type="button" variant={variant} size={size} disabled={busy || disabled}>{children}</Button>}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      busy={busy}
      destructive={destructive}
    />
  );
}

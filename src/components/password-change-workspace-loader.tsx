"use client";

import { useEffect, useState } from "react";
import {
  ChangePasswordForm,
  ForcedChangePasswordForm,
} from "@/components/change-password-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type PasswordContext = {
  email: string;
  mustChangePassword: boolean;
};

type PasswordContextResponse = PasswordContext & { error?: string };

export function PasswordChangeWorkspaceLoader() {
  const [context, setContext] = useState<PasswordContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const response = await fetch("/api/admin/password", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as PasswordContextResponse;
        if (!response.ok) {
          throw new Error(body.error ?? "Account details could not be loaded");
        }
        if (!cancelled) setContext(body);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Account details could not be loaded",
        );
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Alert variant="destructive" role="alert" className="w-full max-w-sm">
        <AlertTitle>Password change unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!context) {
    return (
      <div className="w-full max-w-sm" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading account details…</span>
        <Skeleton className="h-[31rem] w-full rounded-xl" />
      </div>
    );
  }

  return context.mustChangePassword ? (
    <ForcedChangePasswordForm email={context.email} />
  ) : (
    <ChangePasswordForm email={context.email} />
  );
}

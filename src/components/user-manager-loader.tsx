"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { UserManager } from "@/components/user-manager";
import type { Role } from "@/lib/hiring-roles";

type UserRow = { id: string; email: string; name: string; role: Role };

type UsersResponse = {
  users?: Array<UserRow & { mustChangePassword?: boolean; createdAt?: string }>;
  error?: string;
};

export function UserManagerLoader({
  currentUserId,
  refreshNonce,
}: {
  currentUserId: string;
  refreshNonce: number;
}) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setError(null);
      try {
        const response = await fetch("/api/admin/users", {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as UsersResponse;
        if (!response.ok || !body.users) {
          throw new Error(body.error ?? "Hiring team could not be loaded");
        }
        if (!cancelled) {
          setUsers(
            body.users.map(({ id, email, name, role }) => ({
              id,
              email,
              name,
              role,
            })),
          );
        }
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Hiring team could not be loaded",
        );
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Hiring team unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!users) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading hiring team…</span>
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return <UserManager users={users} currentUserId={currentUserId} />;
}

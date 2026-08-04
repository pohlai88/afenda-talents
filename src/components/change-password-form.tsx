"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({ email, forced }: { email: string; forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setBusy(false);
    if (response.ok) {
      router.push("/admin");
      router.refresh();
      return;
    }
    const body = await response.json().catch(() => ({}));
    setError(body.error ?? "Could not change the password");
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <Card>
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <span aria-hidden="true" className="h-[6px] w-[6px] rotate-45 bg-brand-gold" />
            <span className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
              AFENDA TALENTS
            </span>
          </div>
          <CardTitle>{forced ? "Set your own password" : "Change password"}</CardTitle>
          <CardDescription>
            {forced
              ? `The password for ${email} was issued by an admin. Replace it with one only you know before continuing.`
              : `Signed in as ${email}. Your current password stops working as soon as the new one is saved.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">
              {forced ? "Temporary password" : "Current password"}
            </Label>
            <Input
              id="current-password"
              name="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "password-error" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={
                error ? "new-password-hint password-error" : "new-password-hint"
              }
            />
            <p id="new-password-hint" className="text-xs text-muted-foreground">
              At least 12 characters.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Repeat new password</Label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "password-error" : undefined}
            />
          </div>
          {error && (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </Button>
          {!forced && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/admin")}
            >
              Cancel
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}

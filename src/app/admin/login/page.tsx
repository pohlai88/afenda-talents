"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) document.getElementById("email")?.focus();
  }, [error]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => ({}));
      setError(
        typeof body.error === "string" ? body.error : "Sign in failed",
      );
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="mb-1 flex items-center gap-2">
              <span aria-hidden="true" className="h-[6px] w-[6px] rotate-45 bg-brand-gold" />
              <span className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
                AFENDA TALENTS
              </span>
            </div>
            <CardTitle>
              <h1 className="text-base leading-none font-semibold">Hiring team sign in</h1>
            </CardTitle>
            <CardDescription>Candidates don’t sign in — their emailed link is their access.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            {error && (
              <Alert id="login-error" variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}

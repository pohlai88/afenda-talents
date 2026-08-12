"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export function AdminLoginForm({ developerMode }: { developerMode: boolean }) {
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
        body: JSON.stringify({
          email,
          password,
          mode: developerMode ? "developer" : "hiring",
        }),
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

  const title = developerMode
    ? "Developer administrator sign in"
    : "Hiring team sign in";
  const description = developerMode
    ? "Restricted to the designated developer administrator. Normal password, rate-limit, session, and audit controls still apply."
    : "Candidates don’t sign in — their emailed link is their access.";
  const switchHref = developerMode
    ? "/admin/login"
    : "/admin/login?mode=developer";
  const switchLabel = developerMode
    ? "Use hiring team sign in"
    : "Developer administrator sign in";

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
            {developerMode ? (
              <Badge variant="outline" className="mb-2 w-fit font-mono text-[10px] tracking-[0.14em]">
                ADMIN · FULL WORKSPACE ACCESS
              </Badge>
            ) : null}
            <CardTitle>
              <h1 className="text-base leading-none font-semibold">{title}</h1>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            {error ? (
              <Alert id="login-error" variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Signing in…" : developerMode ? "Open developer administration" : "Sign in"}
            </Button>
            <Link
              href={switchHref}
              className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
            >
              {switchLabel}
            </Link>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}

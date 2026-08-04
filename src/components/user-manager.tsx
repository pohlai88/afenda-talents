"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRow = { id: string; email: string; name: string; role: string };

export function UserManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "reset" | "remove"; user: UserRow } | null>(null);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not create the account");
      return;
    }
    setSecret({ email: body.user.email, password: body.temporaryPassword });
    setName("");
    setEmail("");
    router.refresh();
  }

  async function patch(id: string, payload: Record<string, unknown>, forEmail?: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not update the account");
      return;
    }
    if (body.temporaryPassword && forEmail) {
      setSecret({ email: forEmail, password: body.temporaryPassword });
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) setError(body.error ?? "Could not remove the account");
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* The one-time temporary password: a modal it cannot be scrolled past, with the
          role=status text the e2e suite reads. Closes only by explicit acknowledgement. */}
      <Dialog open={secret !== null} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Hand this to the account holder out of band. It is not stored and will not be
              shown again.
            </DialogDescription>
          </DialogHeader>
          {secret && (
            <p role="status" className="rounded-md border bg-muted p-3 font-mono text-sm break-all">
              Temporary password for {secret.email}: {secret.password}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>I have copied it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One confirm dialog for both destructive account actions. Both invalidate
          someone's access, so neither fires on a single click. */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "reset" ? "Reset this password?" : "Remove this account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "reset"
                ? `${confirm.user.name}'s current password stops working. A new temporary password is shown once, and they must set their own at next sign-in.`
                : `${confirm?.user.name} loses access immediately. Their past actions stay in the audit log.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === "remove" ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                if (confirm.kind === "reset") {
                  await patch(confirm.user.id, { resetPassword: true }, confirm.user.email);
                } else {
                  await remove(confirm.user.id);
                }
                setConfirm(null);
              }}
            >
              {confirm?.kind === "reset" ? "Reset password" : "Remove account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            ADMIN acts. VIEWER reads. Nobody can demote or remove themselves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.id !== currentUserId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            patch(user.id, { role: user.role === "ADMIN" ? "VIEWER" : "ADMIN" })
                          }
                        >
                          Make {user.role === "ADMIN" ? "viewer" : "admin"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirm({ kind: "reset", user })}
                      >
                        Reset password
                      </Button>
                      {user.id !== currentUserId && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: "remove", user })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <form onSubmit={createUser}>
        <Card>
          <CardHeader>
            <CardTitle>Add a team member</CardTitle>
            <CardDescription>
              A temporary password is generated and shown once — hand it over out of band.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                  <SelectTrigger id="new-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Viewer — read only</SelectItem>
                    <SelectItem value="ADMIN">Admin — full control</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : "Create account"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

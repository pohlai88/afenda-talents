"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { Role } from "@/lib/hiring-roles";
import {
	apiErrorMessage,
	userCreateResponseSchema,
	userPatchResponseSchema,
	type UserPatchPayload,
} from "@/lib/api-responses";

type UserRow = { id: string; email: string; name: string; role: Role };

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
  const [role, setRole] = useState<Role>("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "reset" | "remove"; user: UserRow } | null>(null);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = apiErrorMessage(body, "Could not create the account");
        setError(message);
        toast.error(message);
        return;
      }
      const parsed = userCreateResponseSchema.safeParse(body);
      if (!parsed.success) {
        setError("Unexpected server response.");
        toast.error("Unexpected server response.");
        return;
      }
      setSecret({ email: parsed.data.user.email, password: parsed.data.temporaryPassword });
      setName("");
      setEmail("");
      toast.success("Account created.");
      router.refresh();
    } catch {
      const message = "Could not reach the server. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: UserPatchPayload, forEmail?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = apiErrorMessage(body, "Could not update the account");
        setError(message);
        toast.error(message);
        return;
      }
      const parsed = userPatchResponseSchema.safeParse(body);
      if (parsed.success && parsed.data.temporaryPassword && forEmail) {
        setSecret({ email: forEmail, password: parsed.data.temporaryPassword });
      }
      toast.success("Account updated.");
      router.refresh();
    } catch {
      const message = "Could not reach the server. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body.error ?? "Could not remove the account";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Account removed.");
      router.refresh();
    } catch {
      const message = "Could not reach the server. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
          <div className="hidden min-w-0 overflow-x-auto md:block">
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
                      <UserRowActions
                        user={user}
                        isSelf={user.id === currentUserId}
                        busy={busy}
                        onRoleToggle={() =>
                          patch(user.id, { role: user.role === "ADMIN" ? "VIEWER" : "ADMIN" })
                        }
                        onReset={() => setConfirm({ kind: "reset", user })}
                        onRemove={() => setConfirm({ kind: "remove", user })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {users.map((user) => (
              <li
                key={user.id}
                className="space-y-3 rounded-lg border border-border px-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge
                    variant={user.role === "ADMIN" ? "default" : "secondary"}
                    className="mt-2"
                  >
                    {user.role}
                  </Badge>
                </div>
                <UserRowActions
                  user={user}
                  isSelf={user.id === currentUserId}
                  busy={busy}
                  onRoleToggle={() =>
                    patch(user.id, { role: user.role === "ADMIN" ? "VIEWER" : "ADMIN" })
                  }
                  onReset={() => setConfirm({ kind: "reset", user })}
                  onRemove={() => setConfirm({ kind: "remove", user })}
                />
              </li>
            ))}
          </ul>
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
                  name="member-name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  name="member-email"
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
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

function UserRowActions({
  user,
  isSelf,
  busy,
  onRoleToggle,
  onReset,
  onRemove,
}: {
  user: UserRow;
  isSelf: boolean;
  busy: boolean;
  onRoleToggle: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {!isSelf && (
        <Button size="sm" variant="outline" disabled={busy} onClick={onRoleToggle}>
          Make {user.role === "ADMIN" ? "viewer" : "admin"}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={busy} onClick={onReset}>
        Reset password
      </Button>
      {!isSelf && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={onRemove}>
          Remove account
        </Button>
      )}
    </div>
  );
}

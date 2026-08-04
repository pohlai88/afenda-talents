"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [notice, setNotice] = useState<string | null>(null);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setNotice(body.error ?? "Could not create the account");
      return;
    }
    setNotice(
      `Account created. Temporary password for ${body.user.email}: ${body.temporaryPassword} — copy it now; it is not shown again.`,
    );
    setName("");
    setEmail("");
    router.refresh();
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setNotice(body.error ?? "Could not update the account");
      return;
    }
    if (body.temporaryPassword) {
      setNotice(
        `New temporary password: ${body.temporaryPassword} — copy it now; it is not shown again.`,
      );
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) setNotice(body.error ?? "Could not remove the account");
    router.refresh();
  }

  return (
    <div className="mt-6">
      {notice && (
        <p role="status" className="mb-4 rounded-md border bg-slate-50 p-3 text-sm break-all">
          {notice}
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">Name</th>
            <th className="pr-3">Email</th>
            <th className="pr-3">Role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-2 pr-3">
                {user.name}
                {user.id === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </td>
              <td className="pr-3">{user.email}</td>
              <td className="pr-3">{user.role}</td>
              <td className="py-1 text-right">
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
                    onClick={() => patch(user.id, { resetPassword: true })}
                  >
                    Reset password
                  </Button>
                  {user.id !== currentUserId && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(user.id)}>
                      Remove
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={createUser} className="mt-8 space-y-4 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Add a team member</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
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
            <select
              id="new-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="VIEWER">Viewer — read only</option>
              <option value="ADMIN">Admin — full control</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Working…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}

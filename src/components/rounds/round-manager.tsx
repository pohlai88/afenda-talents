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
import { cn } from "@/lib/utils";

export type RoundRow = {
  id: string;
  name: string;
  status: string;
  assessmentVersionId: string;
  assessmentTitle: string;
  versionNumber: number;
  assignmentCount: number;
};

export type VersionOption = {
  id: string;
  assessmentTitle: string;
  assessmentKind: string;
  versionNumber: number;
};

const ROUND_STATUS_TONE: Record<string, string> = {
  DRAFT: "border-border bg-transparent text-muted-foreground",
  OPEN: "border-transparent bg-progress/12 text-progress",
  CLOSED: "border-dashed border-border bg-transparent text-muted-foreground",
  ARCHIVED: "border-dashed border-border bg-transparent text-muted-foreground",
};

const ROUND_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

function RoundStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(ROUND_STATUS_TONE[status])}>
      {ROUND_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// One transition per click keeps the lifecycle legible — no combined "open and invite"
// shortcut. lib/status.ts's assertRoundTransition is the only authority on legality;
// this just offers the primary next step for the round's current status. DRAFT rounds
// get a second, quieter "Abandon" action straight to ARCHIVED (design §4).
const NEXT_TRANSITION: Record<string, { to: string; label: string } | undefined> = {
  DRAFT: { to: "OPEN", label: "Open round" },
  OPEN: { to: "CLOSED", label: "Close round" },
  CLOSED: { to: "ARCHIVED", label: "Archive round" },
};

const TRANSITION_COPY: Record<string, { title: string; description: string; confirmLabel: string }> = {
  OPEN: {
    title: "Open this round?",
    description:
      "The assigned assessment version locks — it can no longer be changed once candidates may be invited.",
    confirmLabel: "Open round",
  },
  CLOSED: {
    title: "Close this round?",
    description:
      "No new invitations can be sent. Links already sent remain valid until they expire or are revoked.",
    confirmLabel: "Close round",
  },
  ARCHIVED: {
    title: "Archive this round?",
    description: "The round becomes read-only history. This cannot be undone.",
    confirmLabel: "Archive round",
  },
};

export function RoundManager({
  rounds,
  versionOptions,
  isAdmin,
}: {
  rounds: RoundRow[];
  versionOptions: VersionOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [versionId, setVersionId] = useState(versionOptions[0]?.id ?? "");

  const [edit, setEdit] = useState<RoundRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editVersionId, setEditVersionId] = useState("");

  const [confirm, setConfirm] = useState<{ round: RoundRow; to: string } | null>(null);

  async function createRound(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, assessmentVersionId: versionId }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not create the round");
      return;
    }
    setName("");
    router.refresh();
  }

  async function patchRound(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/rounds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not update the round");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Confirms the lifecycle step this row is about to take — opening locks the
          version, archiving is permanent, so neither fires on a single accidental click. */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm && TRANSITION_COPY[confirm.to]?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && TRANSITION_COPY[confirm.to]?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                const ok = await patchRound(confirm.round.id, { status: confirm.to });
                if (ok) setConfirm(null);
              }}
            >
              {confirm && TRANSITION_COPY[confirm.to]?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename and version reassignment only ever apply to a draft round — the API
          rejects both once the round has opened. */}
      <Dialog open={edit !== null} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit round</DialogTitle>
            <DialogDescription>
              Draft rounds can be renamed and reassigned to a different published version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-round-name">Name</Label>
              <Input
                id="edit-round-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-round-version">Assessment version</Label>
              <Select value={editVersionId} onValueChange={(v) => v && setEditVersionId(v)}>
                <SelectTrigger id="edit-round-version" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versionOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.assessmentTitle} v{v.versionNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || !editName.trim()}
              onClick={async () => {
                if (!edit) return;
                const ok = await patchRound(edit.id, {
                  name: editName.trim(),
                  assessmentVersionId: editVersionId,
                });
                if (ok) setEdit(null);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Rounds</CardTitle>
          <CardDescription>
            DRAFT → OPEN → CLOSED → ARCHIVED, or DRAFT → ARCHIVED if abandoned. Only an open
            round can be invited into.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hiring rounds yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assessment version</TableHead>
                  <TableHead className="text-right">Assignments</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((round) => {
                  const next = NEXT_TRANSITION[round.status];
                  return (
                    <TableRow key={round.id}>
                      <TableCell className="font-medium">{round.name}</TableCell>
                      <TableCell>
                        <RoundStatusBadge status={round.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {round.assessmentTitle} v{round.versionNumber}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {round.assignmentCount}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {round.status === "DRAFT" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setEdit(round);
                                  setEditName(round.name);
                                  setEditVersionId(round.assessmentVersionId);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                            {next && (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={busy}
                                onClick={() => setConfirm({ round, to: next.to })}
                              >
                                {next.label}
                              </Button>
                            )}
                            {round.status === "DRAFT" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => setConfirm({ round, to: "ARCHIVED" })}
                              >
                                Abandon
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <form onSubmit={createRound}>
          <Card>
            <CardHeader>
              <CardTitle>Create a round</CardTitle>
              <CardDescription>
                Rounds start as drafts. Open one when you are ready to invite candidates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-round-name">Name</Label>
                  <Input
                    id="new-round-name"
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-round-version">Assessment version</Label>
                  <Select value={versionId} onValueChange={(v) => v && setVersionId(v)}>
                    <SelectTrigger id="new-round-version" className="w-full">
                      <SelectValue placeholder="Choose a published version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versionOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.assessmentTitle} v{v.versionNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={busy || !versionId || !name.trim()}>
                {busy ? "Working…" : "Create round"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}

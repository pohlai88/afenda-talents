"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import type { Role } from "@/lib/hiring-roles";
import {
	apiErrorMessage,
	type RoundPatchPayload,
	userCreateResponseSchema,
	userPatchResponseSchema,
	type UserPatchPayload,
} from "@/lib/api-responses";
import type { RoundStatus } from "@/lib/status-constants";

export type RoundRow = {
  id: string;
  name: string;
  status: RoundStatus;
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

const ROUND_STATUS_TONE: Record<RoundStatus, string> = {
  DRAFT: "border-border bg-transparent text-muted-foreground",
  OPEN: "border-transparent bg-progress/12 text-progress",
  CLOSED: "border-dashed border-border bg-transparent text-muted-foreground",
  ARCHIVED: "border-dashed border-border bg-transparent text-muted-foreground",
};

const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

function RoundStatusBadge({ status }: { status: RoundStatus }) {
  return (
    <Badge variant="outline" className={cn(ROUND_STATUS_TONE[status])}>
      {ROUND_STATUS_LABEL[status]}
    </Badge>
  );
}

// One transition per click keeps the lifecycle legible — no combined "open and invite"
// shortcut. lib/status.ts's assertRoundTransition is the only authority on legality;
// this just offers the primary next step for the round's current status. DRAFT rounds
// get a second, quieter "Abandon" action straight to ARCHIVED (design §4).
const NEXT_TRANSITION: Partial<Record<RoundStatus, { to: RoundStatus; label: string }>> = {
  DRAFT: { to: "OPEN", label: "Open round" },
  OPEN: { to: "CLOSED", label: "Close round" },
  CLOSED: { to: "ARCHIVED", label: "Archive round" },
};

const TRANSITION_COPY: Partial<
	Record<RoundStatus, { title: string; description: string; confirmLabel: string }>
> = {
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

  const [confirm, setConfirm] = useState<{ round: RoundRow; to: RoundStatus } | null>(null);

  async function createRound(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, assessmentVersionId: versionId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = apiErrorMessage(body, "Could not create the round");
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Hiring round created.");
      setName("");
      router.refresh();
    } catch {
      const message = "Could not reach the server. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function patchRound(id: string, payload: RoundPatchPayload) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/rounds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = apiErrorMessage(body, "Could not update the round");
        setError(message);
        toast.error(message);
        return false;
      }
      toast.success("Hiring round updated.");
      router.refresh();
      return true;
    } catch {
      const message = "Could not reach the server. Try again.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No hiring rounds yet</EmptyTitle>
                <EmptyDescription>
                  Create a draft round above, then open it before inviting candidates.
                </EmptyDescription>
              </EmptyHeader>
              {isAdmin ? (
                <EmptyContent>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/admin/assessments" />}
                  >
                    Manage assessments
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <>
              <div className="hidden min-w-0 overflow-x-auto md:block">
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
                    {rounds.map((round) => (
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
                            <RoundRowActions
                              round={round}
                              busy={busy}
                              onEdit={() => {
                                setEdit(round);
                                setEditName(round.name);
                                setEditVersionId(round.assessmentVersionId);
                              }}
                              onTransition={(to) => setConfirm({ round, to })}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden">
                {rounds.map((round) => (
                  <li
                    key={round.id}
                    className="space-y-3 rounded-lg border border-border px-3 py-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{round.name}</p>
                      <RoundStatusBadge status={round.status} />
                      <p className="text-sm text-muted-foreground">
                        {round.assessmentTitle} v{round.versionNumber}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {round.assignmentCount} assignment
                        {round.assignmentCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    {isAdmin && (
                      <RoundRowActions
                        round={round}
                        busy={busy}
                        onEdit={() => {
                          setEdit(round);
                          setEditName(round.name);
                          setEditVersionId(round.assessmentVersionId);
                        }}
                        onTransition={(to) => setConfirm({ round, to })}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </>
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

function RoundRowActions({
  round,
  busy,
  onEdit,
  onTransition,
}: {
  round: RoundRow;
  busy: boolean;
  onEdit: () => void;
  onTransition: (to: RoundStatus) => void;
}) {
  const next = NEXT_TRANSITION[round.status];
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {round.status === "DRAFT" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
          Edit
        </Button>
      )}
      {next && (
        <Button
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => onTransition(next.to)}
        >
          {next.label}
        </Button>
      )}
      {round.status === "DRAFT" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onTransition("ARCHIVED")}
        >
          Abandon
        </Button>
      )}
    </div>
  );
}

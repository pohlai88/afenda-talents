"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mail,
  Plus,
  Send,
  Trash2,
  UsersRound,
} from "lucide-react";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  classifyInviteRows,
  inviteRowCounts,
  parseInviteLines,
  validInviteEntries,
  type InviteEntry,
  type InviteRow,
} from "@/lib/invite-parse";

export type InviteRoundOption = {
  id: string;
  name: string;
  versionTitle: string;
};

type DeliveryResult = {
  invited: number;
  skipped: number;
  failed: number;
};

const STATUS_LABEL: Record<InviteRow["status"], string> = {
  valid: "Ready",
  invalid: "Needs correction",
  duplicate: "Duplicate",
  existing: "Already invited",
};

export function InviteWorkspace({
  ttlDays,
  mailFrom,
  openRounds,
  roundExistingEmails,
  invitationPreviewHtml,
  receiptPreviewHtml,
}: {
  ttlDays: number;
  mailFrom: string;
  openRounds: InviteRoundOption[];
  roundExistingEmails: Record<string, string[]>;
  invitationPreviewHtml: string;
  receiptPreviewHtml: string;
}) {
  const router = useRouter();
  const [roundId, setRoundId] = useState(openRounds[0]?.id ?? "");
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeliveryResult | null>(null);

  const existingEmails = useMemo(
    () => new Set(roundExistingEmails[roundId] ?? []),
    [roundExistingEmails, roundId],
  );
  const classifiedRows = useMemo(
    () => reclassify(rows, existingEmails),
    [rows, existingEmails],
  );
  const counts = useMemo(
    () => inviteRowCounts(classifiedRows),
    [classifiedRows],
  );
  const validEntries = useMemo(
    () => validInviteEntries(classifiedRows),
    [classifiedRows],
  );
  const selectedRound = openRounds.find((round) => round.id === roundId) ?? null;

  function selectRound(value: string) {
    setRoundId(value);
    setError(null);
    setResult(null);
  }

  function addSingleCandidate() {
    const next = [
      ...classifiedRows,
      {
        id: globalThis.crypto?.randomUUID?.() ?? `candidate-${Date.now()}`,
        line: classifiedRows.length + 1,
        fullName: singleName,
        email: singleEmail,
      },
    ];
    setRows(classifyInviteRows(next, existingEmails));
    setSingleName("");
    setSingleEmail("");
    setError(null);
    setResult(null);
  }

  function reviewBulkList() {
    const parsed = parseInviteLines(bulkText);
    setRows(classifyInviteRows(parsed, existingEmails));
    setError(null);
    setResult(null);
  }

  function updateRow(
    id: string,
    patch: Partial<Pick<InviteRow, "fullName" | "email">>,
  ) {
    const raw = classifiedRows.map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    );
    setRows(reclassify(raw, existingEmails));
    setResult(null);
  }

  function removeRow(id: string) {
    setRows(
      reclassify(
        classifiedRows.filter((row) => row.id !== id),
        existingEmails,
      ),
    );
    setResult(null);
  }

  async function sendInvitations() {
    if (!roundId || validEntries.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hiringRoundId: roundId,
          candidates: validEntries,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        invited?: number;
        skipped?: number;
        failed?: number;
        failures?: InviteEntry[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Invitations could not be sent");
      }

      const delivery = {
        invited: body.invited ?? 0,
        skipped: body.skipped ?? 0,
        failed: body.failed ?? 0,
      };
      setResult(delivery);
      if (body.failures && body.failures.length > 0) {
        setRows(
          classifyInviteRows(
            body.failures.map((failure, index) => ({
              id: `retry-${index}-${failure.email}`,
              line: index + 1,
              fullName: failure.fullName,
              email: failure.email,
            })),
            existingEmails,
          ),
        );
      } else {
        setRows([]);
        setBulkText("");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Invitations could not be sent",
      );
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  if (openRounds.length === 0) {
    return (
      <Alert>
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>No open hiring round</AlertTitle>
        <AlertDescription>
          Open a hiring round before inviting candidates. Invitations are always bound
          to one immutable assessment version.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {result ? <DeliveryAlert result={result} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Invitation delivery failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-none">
        <CardHeader className="border-b bg-surface-subtle">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Invitation authority</CardTitle>
              <CardDescription>
                Choose the open round that will own every invitation in this batch.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye aria-hidden="true" />
              Preview email
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)]">
          <div className="space-y-2">
            <Label htmlFor="invite-round">Hiring round</Label>
            <Select value={roundId} onValueChange={selectRound}>
              <SelectTrigger id="invite-round" className="w-full">
                <SelectValue placeholder="Choose an open round" />
              </SelectTrigger>
              <SelectContent>
                {openRounds.map((round) => (
                  <SelectItem key={round.id} value={round.id}>
                    <span className="flex min-w-0 flex-col py-0.5">
                      <span className="truncate font-medium">{round.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {round.versionTitle}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border bg-background px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Mail aria-hidden="true" className="size-4 text-progress" />
              Personal one-time links
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Links expire after {ttlDays} day{ttlDays === 1 ? "" : "s"}. Candidate
              accounts are not created.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="border-b bg-surface-subtle">
          <CardTitle>Add candidates</CardTitle>
          <CardDescription>
            Add one person or paste a list, then review every row before sending.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="single" className="gap-5">
            <TabsList aria-label="Candidate entry method">
              <TabsTrigger value="single">Single candidate</TabsTrigger>
              <TabsTrigger value="bulk">Add many</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-0">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full name</Label>
                  <Input
                    id="invite-name"
                    value={singleName}
                    onChange={(event) => setSingleName(event.target.value)}
                    autoComplete="off"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={singleEmail}
                    onChange={(event) => setSingleEmail(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSingleCandidate}
                  disabled={!singleName.trim() && !singleEmail.trim()}
                >
                  <Plus aria-hidden="true" />
                  Review invitation
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="bulk" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="invite-list">One candidate per line</Label>
                <Textarea
                  id="invite-list"
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  placeholder={"Jane Candidate, jane@example.com\nAmir Candidate, amir@example.com"}
                  className="min-h-40 font-mono text-sm"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Format: <span className="font-mono">Full name, email address</span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={reviewBulkList}
                disabled={!bulkText.trim()}
              >
                <UsersRound aria-hidden="true" />
                Parse and review
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="min-w-0 shadow-none">
        <CardHeader className="border-b bg-surface-subtle">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Review before sending</CardTitle>
              <CardDescription>
                Only rows marked Ready will be included. Correct or remove the others.
              </CardDescription>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {counts.valid} ready · {counts.existing} already invited
              {counts.duplicate > 0 ? ` · ${counts.duplicate} duplicate` : ""}
              {counts.invalid > 0 ? ` · ${counts.invalid} invalid` : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {classifiedRows.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
              <UsersRound aria-hidden="true" className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium">No candidates in this batch</p>
              <p className="max-w-md text-xs leading-5 text-muted-foreground">
                Add one candidate or paste a list above. Nothing is sent until you
                confirm the reviewed rows.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {classifiedRows.map((row) => (
                <li
                  key={row.id}
                  className="grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[minmax(10rem,0.8fr)_minmax(13rem,1fr)_minmax(9rem,auto)_auto] md:items-start"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.id}-name`} className="md:sr-only">
                      Full name
                    </Label>
                    <Input
                      id={`${row.id}-name`}
                      value={row.fullName}
                      onChange={(event) =>
                        updateRow(row.id, { fullName: event.target.value })
                      }
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.id}-email`} className="md:sr-only">
                      Email
                    </Label>
                    <Input
                      id={`${row.id}-email`}
                      type="email"
                      value={row.email}
                      onChange={(event) =>
                        updateRow(row.id, { email: event.target.value })
                      }
                      spellCheck={false}
                    />
                  </div>
                  <div className="min-w-0 pt-1.5">
                    <Badge
                      variant={row.status === "valid" ? "outline" : "secondary"}
                      className={
                        row.status === "valid"
                          ? "border-progress/30 bg-progress/8 text-progress"
                          : row.status === "invalid"
                            ? "border-attention/30 bg-attention/8 text-attention"
                            : undefined
                      }
                    >
                      {STATUS_LABEL[row.status]}
                    </Badge>
                    {row.reason ? (
                      <p className="mt-1.5 text-xs leading-4 text-muted-foreground">
                        {row.reason}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeRow(row.id)}
                    aria-label={`Remove ${row.fullName || row.email || "candidate"}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {validEntries.length} invitation{validEntries.length === 1 ? "" : "s"} ready
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedRound
              ? `${selectedRound.name} · ${selectedRound.versionTitle}`
              : "Choose an open hiring round"}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => setConfirmOpen(true)}
          disabled={validEntries.length === 0 || busy}
        >
          <Send aria-hidden="true" />
          Send {validEntries.length} invitation{validEntries.length === 1 ? "" : "s"}
        </Button>
      </div>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        mailFrom={mailFrom}
        invitationHtml={invitationPreviewHtml}
        receiptHtml={receiptPreviewHtml}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send {validEntries.length} invitation
              {validEntries.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each candidate will receive a personal link for {selectedRound?.name}. The
              link expires after {ttlDays} day{ttlDays === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void sendInvitations()}
              disabled={busy}
            >
              {busy ? "Sending…" : "Send invitations"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function reclassify(
  rows: Array<Pick<InviteRow, "id" | "line" | "fullName" | "email">>,
  existingEmails: ReadonlySet<string>,
): InviteRow[] {
  return classifyInviteRows(
    rows.map((row, index) => ({ ...row, line: index + 1 })),
    existingEmails,
  );
}

function DeliveryAlert({ result }: { result: DeliveryResult }) {
  const complete = result.failed === 0;
  return (
    <Alert role="status" variant={complete ? "default" : "destructive"}>
      {complete ? (
        <CheckCircle2 aria-hidden="true" />
      ) : (
        <AlertTriangle aria-hidden="true" />
      )}
      <AlertTitle>
        {complete ? `Invited ${result.invited}` : "Some invitations need retrying"}
      </AlertTitle>
      <AlertDescription>
        {result.invited} sent, {result.skipped} already present, {result.failed} failed.
        {result.failed > 0
          ? " The failed rows remain in the review list so you can send them again."
          : " The candidate registry now reflects the delivered invitations."}
      </AlertDescription>
    </Alert>
  );
}

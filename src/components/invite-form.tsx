"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type Entry = { fullName: string; email: string };

function parsePasted(text: string): Entry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fullName, email] = line.split(",").map((part) => part?.trim() ?? "");
      return { fullName, email };
    })
    .filter((entry) => entry.fullName && entry.email);
}

export function InviteForm({
  invitationPreviewHtml,
  receiptPreviewHtml,
}: {
  invitationPreviewHtml: string;
  receiptPreviewHtml: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const candidates = [...parsePasted(pasted)];
    if (fullName && email) candidates.unshift({ fullName, email });
    if (candidates.length === 0) {
      setMessage("Add at least one candidate.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error ?? "Could not send invitations");
      return;
    }
    setMessage(`Invited ${body.invited}. Skipped ${body.skipped} already-invited address(es).`);
    setFullName("");
    setEmail("");
    setPasted("");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      {/* Rendered from the same HTML builders the sender uses — what you see is what
          is sent. The sample uses a placeholder link; no real token comes near it. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>What candidates receive</DialogTitle>
            <DialogDescription>
              Rendered from the live templates with a sample name and link. The real email
              carries the candidate&apos;s personal one-time link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Invitation — “Your Afenda Talents self-assessment”
              </p>
              <div
                className="rounded-md border bg-white p-4 text-sm [&_a]:pointer-events-none [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: invitationPreviewHtml }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Receipt — “We have received your Afenda Talents self-assessment”
              </p>
              <div
                className="rounded-md border bg-white p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: receiptPreviewHtml }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Invite candidates</CardTitle>
          <CardDescription>
            Each candidate receives a personal one-time link that expires. There are no
            candidate accounts and no passwords — the link is the credential.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or paste many</span>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pasted">One per line as “Name, email”</Label>
            <Textarea
              id="pasted"
              rows={8}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"Amira Yusof, amira@example.com\nDaniel Tan, daniel@example.com"}
            />
          </div>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send invitations"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1 size-3.5" />
            Preview the email
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

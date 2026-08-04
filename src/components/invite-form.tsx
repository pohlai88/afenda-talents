"use client";

import { Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
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
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	classifyInviteRows,
	type InviteRow,
	inviteRowCounts,
	parseInviteLines,
	validInviteEntries,
} from "@/lib/invite-parse";
import { cn } from "@/lib/utils";

type SendResult = { invited: number; skipped: number };

export type OpenRoundOption = {
	id: string;
	name: string;
	/** Assessment title + version, e.g. "Afenda Core Behavioural Profile · v1". */
	versionTitle: string;
};

export function InviteForm({
	invitationPreviewHtml,
	receiptPreviewHtml,
	openRounds,
	roundExistingEmails,
	ttlDays,
}: {
	invitationPreviewHtml: string;
	receiptPreviewHtml: string;
	/** Only OPEN rounds — invitations require one (D18). */
	openRounds: OpenRoundOption[];
	/** Emails already holding an assignment in each round, keyed by round id. */
	roundExistingEmails: Record<string, string[]>;
	ttlDays: number;
}) {
	const router = useRouter();
	const roundSelectId = useId();

	const [roundId, setRoundId] = useState<string | null>(
		openRounds[0]?.id ?? null,
	);
	const selectedRound = openRounds.find((r) => r.id === roundId) ?? null;

	const existingSet = useMemo(
		() =>
			new Set(
				(roundId ? roundExistingEmails[roundId] ?? [] : []).map((e) =>
					e.trim().toLowerCase(),
				),
			),
		[roundExistingEmails, roundId],
	);

	const [mode, setMode] = useState<"single" | "many">("single");
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [pasted, setPasted] = useState("");
	const [rows, setRows] = useState<InviteRow[]>([]);
	const [busy, setBusy] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [result, setResult] = useState<SendResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const singleNameId = useId();
	const singleEmailId = useId();
	const pasteId = useId();

	const counts = inviteRowCounts(rows);
	const toSend = validInviteEntries(rows);

	function changeRound(next: string) {
		setRoundId(next);
		setRows([]);
		setResult(null);
		setError(null);
	}

	function reviewSingle() {
		setResult(null);
		setError(null);
		const parsed = parseInviteLines(`${fullName.trim()}, ${email.trim()}`);
		const classified = classifyInviteRows(parsed, existingSet);
		setRows(classified);
	}

	function reviewPaste() {
		setResult(null);
		setError(null);
		const classified = classifyInviteRows(
			parseInviteLines(pasted),
			existingSet,
		);
		setRows(classified);
	}

	function removeRow(id: string) {
		setRows((prev) => prev.filter((row) => row.id !== id));
	}

	async function send() {
		if (toSend.length === 0 || !roundId) return;
		setBusy(true);
		setError(null);
		const response = await fetch("/api/admin/invite", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ hiringRoundId: roundId, candidates: toSend }),
		});
		const body = await response.json().catch(() => ({}));
		setBusy(false);
		setConfirmOpen(false);

		if (!response.ok) {
			setError(
				typeof body.error === "string"
					? body.error
					: "Could not send invitations",
			);
			return;
		}

		setResult({
			invited: Number(body.invited) || 0,
			skipped: Number(body.skipped) || 0,
		});
		setRows([]);
		setFullName("");
		setEmail("");
		setPasted("");
		router.refresh();
	}

	if (openRounds.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">No open hiring round</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<p className="text-sm text-muted-foreground">
						Invitations require an open hiring round — it determines which
						assessment candidates receive. Open a round under Hiring rounds,
						then return here.
					</p>
					<div>
						<Button
							variant="outline"
							nativeButton={false}
							render={<Link href="/admin/rounds" />}
						>
							Go to hiring rounds
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>What candidates receive</DialogTitle>
						<DialogDescription>
							Rendered from the live templates with a sample name and link. The
							real email carries the candidate&apos;s personal one-time link at
							send time.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div>
							<p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Invitation — “Your Afenda Talents self-assessment”
							</p>
							<EmailHtmlPreview
								className="rounded-md border bg-white p-4 text-sm [&_a]:pointer-events-none [&_a]:underline"
								html={invitationPreviewHtml}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Receipt — “We have received your Afenda Talents self-assessment”
							</p>
							<EmailHtmlPreview
								className="rounded-md border bg-white p-4 text-sm"
								html={receiptPreviewHtml}
							/>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Send {toSend.length} invitation{toSend.length === 1 ? "" : "s"}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{toSend.length} personal link{toSend.length === 1 ? "" : "s"} will
							be emailed for {selectedRound?.name ?? "this round"}. Links
							expire after {ttlDays} day{ttlDays === 1 ? "" : "s"}.{" "}
							{counts.existing + counts.duplicate + counts.invalid > 0
								? `${counts.existing} already invited, ${counts.duplicate} duplicate, and ${counts.invalid} invalid row${counts.invalid === 1 ? "" : "s"} will not be sent.`
								: "Every row in the review list is ready to send."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={busy || toSend.length === 0}
							onClick={() => void send()}
						>
							{busy ? "Sending…" : "Send invitations"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Hiring round</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Label htmlFor={roundSelectId}>Open round</Label>
					<Select
						value={roundId ?? undefined}
						onValueChange={(value) => {
							if (value) changeRound(value);
						}}
					>
						<SelectTrigger id={roundSelectId} className="w-full sm:w-96">
							<SelectValue placeholder="Choose an open round" />
						</SelectTrigger>
						<SelectContent>
							{openRounds.map((round) => (
								<SelectItem key={round.id} value={round.id}>
									{round.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{selectedRound && (
						<p className="text-sm text-muted-foreground">
							Candidates will receive{" "}
							<span className="font-medium text-foreground">
								{selectedRound.versionTitle}
							</span>
							.
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
					<CardTitle className="text-base">Add candidates</CardTitle>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setPreviewOpen(true)}
					>
						<Eye aria-hidden="true" className="size-3.5" />
						Preview the email
					</Button>
				</CardHeader>
				<CardContent>
					<Tabs
						value={mode}
						onValueChange={(value) => {
							if (value === "single" || value === "many") setMode(value);
						}}
					>
						<TabsList aria-label="How to add candidates">
							<TabsTrigger value="single">Single candidate</TabsTrigger>
							<TabsTrigger value="many">Add many</TabsTrigger>
						</TabsList>

						{/* Mount only the active panel — Base UI keeps inactive panels in the DOM,
						    which duplicated “Full name” / “Email” for Playwright and assistive tech. */}
						{mode === "single" ? (
							<TabsContent value="single" className="mt-4 flex flex-col gap-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor={singleNameId}>Full name</Label>
										<Input
											id={singleNameId}
											name="candidate-name"
											autoComplete="off"
											value={fullName}
											onChange={(e) => setFullName(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={singleEmailId}>Email</Label>
										<Input
											id={singleEmailId}
											name="candidate-email"
											type="email"
											autoComplete="off"
											spellCheck={false}
											value={email}
											onChange={(e) => setEmail(e.target.value)}
										/>
									</div>
								</div>
								<div>
									<Button
										type="button"
										variant="secondary"
										disabled={!fullName.trim() || !email.trim() || !roundId}
										onClick={reviewSingle}
									>
										Review invitation
									</Button>
								</div>
							</TabsContent>
						) : (
							<TabsContent value="many" className="mt-4 flex flex-col gap-4">
								<div className="space-y-2">
									<Label htmlFor={pasteId}>One per line as “Name, email”</Label>
									<Textarea
										id={pasteId}
										name="pasted-candidates"
										spellCheck={false}
										rows={8}
										value={pasted}
										onChange={(e) => setPasted(e.target.value)}
										placeholder={
											"Amira Yusof, amira@example.com\nDaniel Tan, daniel@example.com"
										}
									/>
								</div>
								<div>
									<Button
										type="button"
										variant="secondary"
										disabled={!pasted.trim() || !roundId}
										onClick={reviewPaste}
									>
										Parse and review
									</Button>
								</div>
							</TabsContent>
						)}
					</Tabs>
				</CardContent>
			</Card>

			{rows.length > 0 && (
				<Card className="min-w-0 overflow-hidden">
					<CardHeader>
						<CardTitle className="text-base">
							<h2 className="text-base font-semibold">Review before sending</h2>
						</CardTitle>
						<p className="text-sm text-muted-foreground" role="status">
							{counts.valid} ready · {counts.existing} already invited ·{" "}
							{counts.duplicate} duplicate · {counts.invalid} invalid
						</p>
					</CardHeader>
					<CardContent className="min-w-0 px-0 sm:px-6">
						<div className="min-w-0 overflow-x-auto">
							<Table className="min-w-[36rem]">
								<TableCaption className="sr-only">
									Candidates ready for invitation review
								</TableCaption>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="w-12">
											<span className="sr-only">Remove</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell className="font-medium">
												{row.fullName || "—"}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{row.email || "—"}
											</TableCell>
											<TableCell>
												<RowStatusBadge
													status={row.status}
													reason={row.reason}
												/>
											</TableCell>
											<TableCell>
												<Button
													type="button"
													size="icon-sm"
													variant="ghost"
													aria-label={`Remove ${row.fullName || row.email || "row"}`}
													onClick={() => removeRow(row.id)}
												>
													<Trash2 aria-hidden="true" className="size-3.5" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
					<CardFooter className="justify-between gap-3">
						<Button type="button" variant="ghost" onClick={() => setRows([])}>
							Clear list
						</Button>
						<Button
							type="button"
							disabled={toSend.length === 0 || busy || !roundId}
							aria-describedby={error ? "invite-error" : undefined}
							onClick={() => setConfirmOpen(true)}
						>
							Send {toSend.length} invitation{toSend.length === 1 ? "" : "s"}
						</Button>
					</CardFooter>
				</Card>
			)}

			{error && (
				<p id="invite-error" role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			{result && (
				<p
					role="status"
					className="rounded-md border bg-muted/40 px-4 py-3 text-sm"
				>
					Invited {result.invited}. Skipped {result.skipped} already-invited
					address(es).
				</p>
			)}
		</div>
	);
}

function EmailHtmlPreview({
	html,
	className,
}: {
	html: string;
	className?: string;
}) {
	// Trusted server-built templates (same builders as live mail).
	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: email preview from server templates
		<div className={className} dangerouslySetInnerHTML={{ __html: html }} />
	);
}

function RowStatusBadge({
	status,
	reason,
}: {
	status: InviteRow["status"];
	reason: string | null;
}) {
	const label =
		status === "valid"
			? "Ready"
			: status === "existing"
				? "Already invited"
				: status === "duplicate"
					? "Duplicate"
					: "Invalid";

	return (
		<Badge
			variant={status === "valid" ? "secondary" : "outline"}
			title={reason ?? undefined}
			className={cn(status === "valid" && "border-transparent")}
		>
			{label}
			{reason && status !== "valid" ? (
				<span className="font-normal text-muted-foreground"> — {reason}</span>
			) : null}
		</Badge>
	);
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

const CONFIRMATION = "DELETE ALL CANDIDATE DATA";

/**
 * Purge-all control (UI §11.4). Type-the-phrase, then a final dialog.
 * Never place this next to invite or export actions.
 */
export function DangerZone({
	retentionDays,
	candidateCount,
}: {
	retentionDays: number;
	candidateCount: number;
}) {
	const router = useRouter();
	const [confirmation, setConfirmation] = useState("");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const phraseMatches = confirmation === CONFIRMATION;

	async function purge() {
		setBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/admin/purge", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ confirmation }),
			});
			const body = await response.json().catch(() => ({}));
			setConfirmOpen(false);
			if (response.ok) {
				setMessage(`Deleted ${body.deleted} candidate record(s).`);
				setConfirmation("");
			} else {
				setMessage(
					typeof body.error === "string"
						? body.error
						: "Could not delete candidate data",
				);
			}
			router.refresh();
		} catch {
			setConfirmOpen(false);
			setMessage(
				"Could not delete candidate data. Check your connection and try again.",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Card className="border-destructive/40 print:hidden">
				<CardHeader>
					<CardTitle className="text-destructive">
						Delete all candidate data
					</CardTitle>
					<CardDescription>
						Candidates were told their responses are kept for {retentionDays}{" "}
						days from submission. Honouring that is a manual step — this is how
						you do it.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<p className="text-sm text-muted-foreground">
						This will permanently remove{" "}
						<strong className="font-medium text-foreground tabular-nums">
							{candidateCount}
						</strong>{" "}
						candidate record{candidateCount === 1 ? "" : "s"} — names, emails,
						answers, and results. The audit log keeps an identity-free record
						that the deletion happened.
					</p>

					<div className="space-y-2">
						<Label htmlFor="purge-confirmation">
							Type {CONFIRMATION} to enable deletion
						</Label>
						<div className="flex flex-wrap items-center gap-2">
							<Input
								id="purge-confirmation"
								className="max-w-xs"
								name="purge-confirmation"
								autoComplete="off"
								spellCheck={false}
								aria-describedby="purge-confirmation-hint"
								placeholder={CONFIRMATION}
								value={confirmation}
								onChange={(e) => setConfirmation(e.target.value)}
							/>
							<span id="purge-confirmation-hint" className="sr-only">
								Type the phrase {CONFIRMATION} exactly to enable deletion
							</span>
							<Button
								variant="destructive"
								disabled={busy || !phraseMatches}
								onClick={() => setConfirmOpen(true)}
							>
								Delete all candidate data
							</Button>
						</div>
					</div>

					{message && (
						<p role="status" className="text-sm">
							{message}
						</p>
					)}
				</CardContent>
			</Card>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {candidateCount} candidate record
							{candidateCount === 1 ? "" : "s"} permanently?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This cannot be undone. Audit rows remain without names or emails.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={busy}
							onClick={() => void purge()}
						>
							{busy ? "Deleting…" : "Delete permanently"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

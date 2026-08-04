"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon } from "lucide-react";

/** Header action: create a blank assessment, then go straight into the builder. */
export function NewAssessmentButton() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function createBlank(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const response = await fetch("/api/admin/assessments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: title.trim() || undefined }),
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body.id) {
				setError(body.error ?? "Could not create the assessment.");
				setBusy(false);
				return;
			}
			router.push(`/admin/assessments/${body.id}/edit`);
		} catch {
			setError("Could not reach the server.");
			setBusy(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
			<DialogTrigger render={<Button />}>
				<PlusIcon />
				New assessment
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={createBlank}>
					<DialogHeader>
						<DialogTitle>New assessment</DialogTitle>
						<DialogDescription>
							Starts blank with one section and one Likert item — the builder opens right after.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Label htmlFor="new-assessment-title" className="flex flex-col gap-1.5">
							Title
							<Input
								id="new-assessment-title"
								autoFocus
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Untitled assessment"
							/>
						</Label>
						{error && (
							<p role="alert" className="mt-2 text-sm text-destructive">
								{error}
							</p>
						)}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={busy}>
							{busy ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** Row action: duplicate into a new organisation-owned draft, then open it. */
export function DuplicateAssessmentButton({
	assessmentId,
	label = "Duplicate",
}: {
	assessmentId: string;
	label?: string;
}) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function duplicate() {
		setBusy(true);
		setError(null);
		try {
			const response = await fetch("/api/admin/assessments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromAssessmentId: assessmentId }),
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body.id) {
				setError(body.error ?? "Could not duplicate this assessment.");
				setBusy(false);
				return;
			}
			router.push(`/admin/assessments/${body.id}/edit`);
		} catch {
			setError("Could not reach the server.");
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button size="sm" variant="outline" disabled={busy} onClick={() => void duplicate()}>
				{busy ? "Duplicating…" : label}
			</Button>
			{error && (
				<p role="alert" className="text-xs text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}

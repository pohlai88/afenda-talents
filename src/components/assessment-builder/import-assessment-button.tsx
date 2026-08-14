"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { apiErrorMessage } from "@/lib/api-responses";
import { IMPORT_FORMATS, MAX_IMPORT_BYTES, type ImportFormat } from "@/lib/instrument-import";

type PreviewIssue = {
	severity: "hard" | "soft";
	code: string;
	message: string;
	path?: string;
	sheetRef?: string;
};

type PreviewOk = {
	documentHash: string;
	diff: {
		summary: {
			breaking: boolean;
			orderOnly: boolean;
			unreachableBands: boolean;
			itemCountChanged: boolean;
			staleBase: boolean;
			invisibleFieldRevert: boolean;
			contextRulesSheetDrift: boolean;
		};
		entries: Array<{ change: string; entityType: string; path: string }>;
	};
	issues: PreviewIssue[];
	committable: boolean;
	sourceMode?: "strict" | "draft";
};

/** Chunked so a 2 MiB upload does not blow the argument limit of fromCharCode. */
async function fileToBase64(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

function formatOf(file: File): ImportFormat | null {
	const ext = file.name.split(".").pop()?.toLowerCase();
	return (IMPORT_FORMATS as readonly string[]).includes(ext ?? "")
		? (ext as ImportFormat)
		: null;
}

const SUMMARY_WARNINGS: Array<[keyof PreviewOk["diff"]["summary"], string]> = [
	["breaking", "Changes existing items in a way that breaks comparability with past results."],
	["itemCountChanged", "The number of items changes."],
	["unreachableBands", "Some bands can no longer be reached by any score."],
	["staleBase", "The file was exported from an older version of this assessment."],
	["invisibleFieldRevert", "Fields the spreadsheet cannot carry would be reverted."],
	["contextRulesSheetDrift", "The ContextRules sheet was edited — Excel cannot edit rules."],
];

/**
 * Upload an instrument as a draft. `targetId` null creates a new assessment;
 * otherwise the upload replaces that assessment's draft. Preview always runs
 * first, and the hash it returns is what commit applies — so what is written is
 * what was shown.
 */
export function ImportAssessmentButton({
	targetId = null,
	label = "Import",
}: {
	targetId?: string | null;
	label?: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<PreviewOk | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setFile(null);
		setPreview(null);
		setError(null);
		setBusy(false);
	}

	async function runPreview(event: React.FormEvent) {
		event.preventDefault();
		if (!file) return;
		const format = formatOf(file);
		if (!format) {
			setError("Choose an .xlsx, .json or .csv file.");
			return;
		}
		if (file.size > MAX_IMPORT_BYTES) {
			setError(`That file is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MiB.`);
			return;
		}

		setBusy(true);
		setError(null);
		try {
			const response = await fetch("/api/admin/assessments/import/preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					format,
					targetId,
					content: await fileToBase64(file),
				}),
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				setError(apiErrorMessage(body, "Could not read that file."));
			} else if (body.refuse) {
				setError(body.refuse);
			} else {
				setPreview(body as PreviewOk);
			}
		} catch {
			setError("Could not reach the server.");
		}
		setBusy(false);
	}

	async function commit() {
		if (!file || !preview) return;
		setBusy(true);
		setError(null);
		try {
			const response = await fetch("/api/admin/assessments/import/commit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					format: formatOf(file),
					targetId,
					content: await fileToBase64(file),
					previewHash: preview.documentHash,
				}),
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body.id) {
				setError(apiErrorMessage(body, "Could not import that file."));
				setBusy(false);
				return;
			}
			setOpen(false);
			router.push(`/admin/assessments/${body.id}/edit`);
		} catch {
			setError("Could not reach the server.");
			setBusy(false);
		}
	}

	const hardIssues = preview?.issues.filter((i) => i.severity === "hard") ?? [];
	const softIssues = preview?.issues.filter((i) => i.severity !== "hard") ?? [];
	const warnings = preview
		? SUMMARY_WARNINGS.filter(([key]) => preview.diff.summary[key])
		: [];

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (busy) return;
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger render={<Button variant="outline" />}>
				<UploadIcon />
				{label}
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto">
				<form onSubmit={runPreview}>
					<DialogHeader>
						<DialogTitle>
							{targetId ? "Import into this assessment" : "Import an assessment"}
						</DialogTitle>
						<DialogDescription>
							{targetId
								? "Replaces the current draft. Nothing is written until you confirm the preview."
								: "Creates a new draft from a spreadsheet or JSON export. Nothing is written until you confirm the preview."}
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-4 py-4">
						<Label htmlFor="import-file" className="flex flex-col gap-1.5">
							File
							<Input
								id="import-file"
								type="file"
								accept=".xlsx,.json,.csv"
								disabled={busy}
								onChange={(e) => {
									setFile(e.target.files?.[0] ?? null);
									setPreview(null);
									setError(null);
								}}
							/>
						</Label>

						{preview && (
							<div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
								<p className="font-medium">
									{preview.diff.entries.length} change
									{preview.diff.entries.length === 1 ? "" : "s"}
									{preview.sourceMode === "draft" && " · imported as a draft"}
								</p>

								{warnings.length > 0 && (
									<ul className="list-disc pl-5 text-muted-foreground">
										{warnings.map(([key, text]) => (
											<li key={key}>{text}</li>
										))}
									</ul>
								)}

								{hardIssues.length > 0 && (
									<div>
										<p className="font-medium text-destructive">
											{hardIssues.length} blocking issue
											{hardIssues.length === 1 ? "" : "s"}
										</p>
										<ul className="list-disc pl-5 text-muted-foreground">
											{hardIssues.slice(0, 8).map((issue, i) => (
												<li key={`${issue.code}-${i}`}>
													{issue.message}
													{issue.sheetRef ? ` (${issue.sheetRef})` : ""}
												</li>
											))}
										</ul>
										{hardIssues.length > 8 && (
											<p className="text-muted-foreground">
												…and {hardIssues.length - 8} more.
											</p>
										)}
									</div>
								)}

								{softIssues.length > 0 && (
									<p className="text-muted-foreground">
										{softIssues.length} item
										{softIssues.length === 1 ? "" : "s"} needed cleaning up on the
										way in — review them in the builder.
									</p>
								)}

								{preview.committable && hardIssues.length === 0 && (
									<p className="text-muted-foreground">
										No blocking issues. Importing opens the builder on the new
										draft; publish separately when you are ready.
									</p>
								)}
							</div>
						)}

						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						{preview ? (
							<Button
								type="button"
								disabled={busy || !preview.committable}
								onClick={() => void commit()}
							>
								{busy ? "Importing…" : "Import"}
							</Button>
						) : (
							<Button type="submit" disabled={busy || !file}>
								{busy ? "Reading…" : "Preview"}
							</Button>
						)}
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

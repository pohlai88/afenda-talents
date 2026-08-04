"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CandidateShell } from "@/components/candidate/shell";
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
import { LIKERT_LABELS } from "@/lib/instrument-labels";
import { scrollIntoViewAware } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Item = { id: string; order: number; text: string };

type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

const SAVE_DEBOUNCE_MS = 800;
const SUBMIT_FLUSH_WAIT_MS = 400;

function saveStatusLabel(status: SaveStatus): string {
	switch (status) {
		case "saving":
			return "Saving…";
		case "saved":
			return "Saved";
		case "error":
			return "Could not save — retrying";
		case "offline":
			return "Offline — reconnecting";
		default:
			return "";
	}
}

/** Module-level so Date.now is not flagged as render impurity. */
async function persistCandidateAnswer(
	itemId: string,
	value: number,
	shownAt: Record<string, number>,
	setSaveStatus: (status: SaveStatus) => void,
	isRetry = false,
): Promise<void> {
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		setSaveStatus("offline");
		return;
	}

	const startedAt = shownAt[itemId] ?? Date.now();
	const msOnItem = Math.max(0, Date.now() - startedAt);
	shownAt[itemId] = Date.now();
	setSaveStatus("saving");

	try {
		const response = await fetch("/api/candidate/autosave", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ itemId, value, msOnItem }),
			keepalive: true,
		});
		if (!response.ok) throw new Error("autosave failed");
		setSaveStatus("saved");
	} catch {
		setSaveStatus("error");
		if (!isRetry) {
			window.setTimeout(() => {
				void persistCandidateAnswer(itemId, value, shownAt, setSaveStatus, true);
			}, 1500);
		}
	}
}

/**
 * All 34 items on one scrolling page, mobile-first (UI §12.3–12.6).
 * Autosave only claims “Saved” after the request succeeds.
 */
export function AssessmentForm({
	token,
	items,
	saved,
}: {
	token: string;
	items: Item[];
	saved: Record<string, number>;
}) {
	const router = useRouter();
	const hadSavedAnswers = Object.keys(saved).length > 0;

	const [answers, setAnswers] = useState<Record<string, number>>(saved);
	const [missing, setMissing] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [showResumeNotice, setShowResumeNotice] = useState(hadSavedAnswers);

	const shownAt = useRef<Record<string, number>>({});
	const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const resumeScrolled = useRef(false);

	useEffect(() => {
		const now = Date.now();
		for (const item of items) shownAt.current[item.id] ??= now;
	}, [items]);

	useEffect(() => {
		function syncOnline() {
			setSaveStatus((prev) => (prev === "offline" ? "idle" : prev));
		}
		function syncOffline() {
			setSaveStatus("offline");
		}
		window.addEventListener("online", syncOnline);
		window.addEventListener("offline", syncOffline);
		const onlineCheck = window.setTimeout(() => {
			if (!navigator.onLine) setSaveStatus("offline");
		}, 0);
		return () => {
			window.clearTimeout(onlineCheck);
			window.removeEventListener("online", syncOnline);
			window.removeEventListener("offline", syncOffline);
		};
	}, []);

	useEffect(() => {
		if (!hadSavedAnswers || resumeScrolled.current) return;
		resumeScrolled.current = true;
		const firstUnanswered = items.find((item) => saved[item.id] === undefined);
		const targetId = firstUnanswered?.id ?? items[0]?.id;
		if (!targetId) return;
		requestAnimationFrame(() => {
			scrollIntoViewAware(document.getElementById(`item-${targetId}`));
		});
	}, [hadSavedAnswers, items, saved]);

	function choose(itemId: string, value: number) {
		setAnswers((prev) => ({ ...prev, [itemId]: value }));
		setMissing((prev) => prev.filter((id) => id !== itemId));
		clearTimeout(timers.current[itemId]);
		timers.current[itemId] = setTimeout(() => {
			void persistCandidateAnswer(itemId, value, shownAt.current, setSaveStatus);
		}, SAVE_DEBOUNCE_MS);
	}

	function reviewUnanswered() {
		const unanswered = items
			.filter((i) => answers[i.id] === undefined)
			.map((i) => i.id);
		if (unanswered.length === 0) return;
		setMissing(unanswered);
		scrollIntoViewAware(document.getElementById(`item-${unanswered[0]}`));
	}

	function requestSubmit() {
		const unanswered = items
			.filter((i) => answers[i.id] === undefined)
			.map((i) => i.id);
		if (unanswered.length > 0) {
			setMissing(unanswered);
			scrollIntoViewAware(document.getElementById(`item-${unanswered[0]}`));
			return;
		}
		setConfirmOpen(true);
	}

	async function confirmSubmit() {
		setBusy(true);
		setError(null);
		for (const [itemId, value] of Object.entries(answers)) {
			clearTimeout(timers.current[itemId]);
			await persistCandidateAnswer(itemId, value, shownAt.current, setSaveStatus);
		}
		await new Promise((resolve) => setTimeout(resolve, SUBMIT_FLUSH_WAIT_MS));

		const response = await fetch("/api/candidate/submit", { method: "POST" });
		if (response.ok) {
			router.push(`/a/${token}/done`);
			return;
		}
		const body = await response.json().catch(() => ({}));
		setBusy(false);
		setConfirmOpen(false);
		if (Array.isArray(body.unanswered)) setMissing(body.unanswered);
		setError(
			typeof body.error === "string"
				? body.error
				: "Could not submit. Please try again.",
		);
	}

	const answered = Object.keys(answers).length;
	const total = items.length;
	const progressLabel = `${answered} of ${total} answered`;
	const statusText = saveStatusLabel(saveStatus);
	const progressPct = total === 0 ? 0 : Math.round((answered / total) * 100);

	return (
		<CandidateShell
			progress={
				<div className="text-right text-xs text-muted-foreground">
					<p className="tabular-nums font-medium text-foreground" aria-hidden>
						{progressLabel}
					</p>
					{statusText ? (
						<p className="text-[11px]" aria-hidden>
							{statusText}
						</p>
					) : null}
				</div>
			}
		>
			<main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-5 pb-40 outline-none">
				<h1 className="text-lg font-semibold tracking-tight">
					Your self-assessment
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					There are no right or wrong answers. Choose what is true of how you
					actually work.
				</p>

				{showResumeNotice && (
					<div
						role="status"
						className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
					>
						<p>Your previous answers were restored.</p>
						<button
							type="button"
							className="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onClick={() => setShowResumeNotice(false)}
						>
							Dismiss
						</button>
					</div>
				)}

				{/* Sticky progress — single live region for save + progressbar for count */}
				<div className="sticky top-[3.25rem] z-10 -mx-4 mt-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
					<div
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={total}
						aria-valuenow={answered}
						aria-valuetext={progressLabel}
						aria-label="Assessment progress"
						className="h-1.5 overflow-hidden rounded-full bg-muted"
					>
						<div
							className="h-full rounded-full bg-progress transition-[width] duration-300 motion-reduce:transition-none"
							style={{ width: `${progressPct}%` }}
							aria-hidden
						/>
					</div>
					<div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
						<span className="tabular-nums" aria-hidden>
							{progressLabel}
						</span>
						<span aria-live="polite" aria-atomic="true" className="min-h-[1em]">
							{statusText}
						</span>
					</div>
				</div>

				<ol className="mt-6 space-y-5">
					{items.map((item) => {
						const isMissing = missing.includes(item.id);
						const selectedValue = answers[item.id];
						const errorId = `item-${item.id}-error`;
						return (
							<li
								key={item.id}
								id={`item-${item.id}`}
								className={cn(
									"scroll-mt-28 border-b border-border/70 py-4 last:border-b-0",
									isMissing &&
										"rounded-md bg-destructive/5 px-3 ring-1 ring-destructive/40",
								)}
							>
								<p
									id={`item-${item.id}-prompt`}
									className="text-sm font-medium leading-snug"
								>
									<span className="mr-2 text-muted-foreground tabular-nums">
										{item.order}.
									</span>
									{item.text}
								</p>
								<fieldset
									className="mt-3 m-0 min-w-0 border-0 p-0"
									aria-invalid={isMissing || undefined}
									aria-describedby={isMissing ? errorId : undefined}
								>
									<legend className="sr-only">
										Statement {item.order}: {item.text}
									</legend>
									<div className="grid grid-cols-5 gap-1.5">
										{([1, 2, 3, 4, 5] as const).map((value) => {
											const selected = selectedValue === value;
											const optionId = `item-${item.id}-v${value}`;
											return (
												<label
													key={value}
													htmlFor={optionId}
													className={cn(
														"flex h-14 cursor-pointer touch-manipulation items-center justify-center rounded-md border text-base font-medium transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
														selected
															? "border-primary bg-primary text-primary-foreground"
															: "border-border bg-card active:bg-muted",
													)}
												>
													<input
														id={optionId}
														type="radio"
														className="sr-only"
														name={`item-${item.id}`}
														value={value}
														checked={selected}
														onChange={() => choose(item.id, value)}
														aria-label={LIKERT_LABELS[value - 1]}
													/>
													<span aria-hidden="true">{value}</span>
												</label>
											);
										})}
									</div>
								</fieldset>
								<div
									className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"
									aria-hidden="true"
								>
									<span>{LIKERT_LABELS[0]}</span>
									<span>{LIKERT_LABELS[4]}</span>
								</div>
								{isMissing && (
									<p id={errorId} role="alert" className="mt-2 text-xs text-destructive">
										Please answer this one.
									</p>
								)}
							</li>
						);
					})}
				</ol>

				<div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
					<div className="mx-auto max-w-xl space-y-2">
						{error && (
							<p id="submit-error" role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}
						{missing.length > 0 && (
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={reviewUnanswered}
							>
								Review unanswered ({missing.length})
							</Button>
						)}
						<p className="text-xs text-muted-foreground tabular-nums" aria-hidden>
							{progressLabel}
						</p>
						<Button
							className="w-full"
							size="lg"
							disabled={busy}
							aria-describedby={error ? "submit-error" : undefined}
							onClick={requestSubmit}
						>
							{busy ? "Submitting…" : "Submit"}
						</Button>
					</div>
				</div>
			</main>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Submit your answers?</AlertDialogTitle>
						<AlertDialogDescription>
							You have answered {answered} of {total} statements. After you
							submit, responses cannot be changed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>
							Keep reviewing
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={busy}
							onClick={() => void confirmSubmit()}
						>
							{busy ? "Submitting…" : "Submit assessment"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</CandidateShell>
	);
}

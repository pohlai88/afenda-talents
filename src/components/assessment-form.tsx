"use client";

import { CheckCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-responses";
import type {
	AssessmentFormBlock,
	AssessmentFormItem,
} from "@/lib/candidate-form";
import { LIKERT_LABELS } from "@/lib/instrument-labels";
import { scrollAndFocus } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type {
	AssessmentFormBlock,
	AssessmentFormItem,
} from "@/lib/candidate-form";

type SavedAnswer = { value?: number; textValue?: string };
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

function isAnswered(item: AssessmentFormItem, answer: SavedAnswer | undefined): boolean {
	if (!answer) return false;
	if (item.type === "likert") return answer.value !== undefined;
	if (!item.required) return true;
	return Boolean(answer.textValue?.trim());
}

async function persistAnswer(
	item: AssessmentFormItem,
	answer: SavedAnswer,
	shownAt: Record<string, number>,
	setSaveStatus: (status: SaveStatus) => void,
	isRetry = false,
): Promise<void> {
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		setSaveStatus("offline");
		return;
	}

	const startedAt = shownAt[item.id] ?? Date.now();
	const msOnItem = Math.max(0, Date.now() - startedAt);
	shownAt[item.id] = Date.now();
	setSaveStatus("saving");

	const body =
		item.type === "likert"
			? { itemId: item.id, value: answer.value, msOnItem }
			: { itemId: item.id, textValue: answer.textValue ?? "", msOnItem };

	try {
		const response = await fetch("/api/candidate/autosave", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			keepalive: true,
		});
		if (!response.ok) throw new Error("autosave failed");
		setSaveStatus("saved");
	} catch {
		setSaveStatus("error");
		if (!isRetry) {
			window.setTimeout(() => {
				void persistAnswer(item, answer, shownAt, setSaveStatus, true);
			}, 1500);
		}
	}
}

export function AssessmentForm({
	token,
	blocks,
	saved,
}: {
	token: string;
	blocks: AssessmentFormBlock[];
	saved: Record<string, SavedAnswer>;
}) {
	const router = useRouter();
	const hadSavedAnswers = Object.keys(saved).length > 0;
	/** Progress, validation and submission only ever concern answerable items. */
	const items = useMemo(
		() => blocks.flatMap((block) => (block.kind === "item" ? [block.item] : [])),
		[blocks],
	);

	const [answers, setAnswers] = useState<Record<string, SavedAnswer>>(saved);
	const [missing, setMissing] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [showResumeNotice, setShowResumeNotice] = useState(hadSavedAnswers);

	const shownAt = useRef<Record<string, number>>({});
	const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const resumeScrolled = useRef(false);
	const itemsById = useRef(new Map(items.map((i) => [i.id, i])));
	itemsById.current = new Map(items.map((i) => [i.id, i]));

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
		return () => {
			window.removeEventListener("online", syncOnline);
			window.removeEventListener("offline", syncOffline);
		};
	}, []);

	useEffect(() => {
		if (!hadSavedAnswers || resumeScrolled.current) return;
		resumeScrolled.current = true;
		const firstUnanswered = items.find((item) => !isAnswered(item, saved[item.id]));
		const targetId = firstUnanswered?.id ?? items[0]?.id;
		if (!targetId) return;
		requestAnimationFrame(() => {
			const item = itemsById.current.get(targetId);
			const container = document.getElementById(`item-${targetId}`);
			let focusTarget: HTMLElement | null = null;
			if (item?.type === "likert") {
				focusTarget =
					document.querySelector<HTMLInputElement>(
						`input[name="item-${targetId}"]:checked`,
					) ?? document.getElementById(`item-${targetId}-v1`);
			} else {
				focusTarget = document.getElementById(`item-${targetId}-input`);
			}
			scrollAndFocus(container, focusTarget);
		});
	}, [hadSavedAnswers, items, saved]);

	function scheduleSave(itemId: string, next: SavedAnswer) {
		const item = itemsById.current.get(itemId);
		if (!item) return;
		clearTimeout(timers.current[itemId]);
		timers.current[itemId] = setTimeout(() => {
			void persistAnswer(item, next, shownAt.current, setSaveStatus);
		}, SAVE_DEBOUNCE_MS);
	}

	function chooseLikert(itemId: string, value: number) {
		const next = { value };
		setAnswers((prev) => ({ ...prev, [itemId]: next }));
		setMissing((prev) => prev.filter((id) => id !== itemId));
		scheduleSave(itemId, next);
	}

	function changeText(itemId: string, textValue: string) {
		const next = { textValue };
		setAnswers((prev) => ({ ...prev, [itemId]: next }));
		setMissing((prev) => prev.filter((id) => id !== itemId));
		scheduleSave(itemId, next);
	}

	function unansweredIds() {
		return items.filter((i) => !isAnswered(i, answers[i.id])).map((i) => i.id);
	}

	function focusItemControl(itemId: string) {
		const item = itemsById.current.get(itemId);
		const container = document.getElementById(`item-${itemId}`);
		let focusTarget: HTMLElement | null = null;
		if (item?.type === "likert") {
			focusTarget =
				document.querySelector<HTMLInputElement>(
					`input[name="item-${itemId}"]:checked`,
				) ?? document.getElementById(`item-${itemId}-v1`);
		} else {
			focusTarget = document.getElementById(`item-${itemId}-input`);
		}
		scrollAndFocus(container, focusTarget);
	}

	function reviewUnanswered() {
		const unanswered = unansweredIds();
		if (unanswered.length === 0) return;
		setMissing(unanswered);
		focusItemControl(unanswered[0]);
	}

	function requestSubmit() {
		const unanswered = unansweredIds();
		if (unanswered.length > 0) {
			setMissing(unanswered);
			focusItemControl(unanswered[0]);
			return;
		}
		setConfirmOpen(true);
	}

	async function confirmSubmit() {
		setBusy(true);
		setError(null);
		for (const item of items) {
			const answer = answers[item.id];
			if (!answer) continue;
			clearTimeout(timers.current[item.id]);
			await persistAnswer(item, answer, shownAt.current, setSaveStatus);
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
		if (Array.isArray(body.unanswered) && body.unanswered.length > 0) {
			setMissing(body.unanswered);
			focusItemControl(body.unanswered[0]);
		}
		setError(
			apiErrorMessage(body, "Could not submit. Please try again."),
		);
	}

	const answered = items.filter((i) => isAnswered(i, answers[i.id])).length;
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
				<h1 className="text-lg font-semibold tracking-tight">Your self-assessment</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					There are no right or wrong answers. Choose what is true of how you
					actually work.
				</p>

				{showResumeNotice && (
					<Alert className="mt-4" role="status">
						<CheckCircleIcon className="size-4" />
						<AlertDescription>Your previous answers were restored.</AlertDescription>
						<AlertAction>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={() => setShowResumeNotice(false)}
							>
								Dismiss
							</Button>
						</AlertAction>
					</Alert>
				)}

				<div className="sticky top-[3.25rem] z-10 -mx-4 mt-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
					<Progress
						value={progressPct}
						className="[&_[data-slot=progress-track]]:h-1.5"
						aria-label="Assessment progress"
						aria-valuetext={progressLabel}
					>
						<ProgressLabel className="sr-only">Progress</ProgressLabel>
						<ProgressValue className="text-xs text-muted-foreground tabular-nums" />
					</Progress>
					{statusText && (
						<p aria-live="polite" aria-atomic="true" className="mt-1 text-right text-[11px] text-muted-foreground">
							{statusText}
						</p>
					)}
				</div>

				<ol className="mt-6 space-y-3">
					{blocks.map((block) => {
						if (block.kind === "section") {
							return (
								<li
									key={`section-${block.id}`}
									className="list-none pt-4 first:pt-0"
								>
									<div className="border-l-2 border-primary pl-3">
										<h2 className="text-sm font-semibold text-foreground">
											{block.title}
										</h2>
										{block.introduction ? (
											<p className="mt-1 text-xs text-muted-foreground">
												{block.introduction}
											</p>
										) : null}
									</div>
								</li>
							);
						}
						if (block.kind === "info") {
							return (
								<li key={`info-${block.id}`} className="list-none">
									<Card className="border-dashed bg-muted/50 shadow-none">
										<CardContent className="px-4 py-3 text-sm leading-relaxed text-muted-foreground">
											{block.body}
										</CardContent>
									</Card>
								</li>
							);
						}
						const item = block.item;
						const isMissing = missing.includes(item.id);
						const answer = answers[item.id];
						const errorId = `item-${item.id}-error`;
						return (
							<li
								key={item.id}
								id={`item-${item.id}`}
								className="scroll-mt-28"
							>
							<Card className={cn(
								"shadow-none transition-colors",
								isMissing && "ring-1 ring-destructive/60 bg-destructive/5",
							)}>
							<CardContent className="px-4 py-3">
								<p
									id={`item-${item.id}-prompt`}
									className="text-sm font-medium leading-snug"
								>
									<span className="mr-2 text-muted-foreground tabular-nums">
										{item.order}.
									</span>
									{item.text}
									{item.required ? null : (
										<span className="ml-1 font-normal text-muted-foreground">
											(optional)
										</span>
									)}
								</p>

								{item.type === "likert" ? (
									<>
										<fieldset
											className="mt-3 m-0 min-w-0 border-0 p-0"
											aria-labelledby={`item-${item.id}-prompt`}
											aria-invalid={isMissing || undefined}
											aria-describedby={isMissing ? errorId : undefined}
										>
											<div className="grid grid-cols-5 gap-1.5">
												{([1, 2, 3, 4, 5] as const).map((value) => {
													const selected = answer?.value === value;
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
																onChange={() => chooseLikert(item.id, value)}
																aria-label={LIKERT_LABELS[value - 1]}
															/>
															<span aria-hidden="true" className="pointer-events-none">
																{value}
															</span>
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
									</>
								) : (
									<div className="mt-3 space-y-1.5">
										{item.helperText ? (
											<p
												id={`item-${item.id}-help`}
												className="text-xs text-muted-foreground"
											>
												{item.helperText}
											</p>
										) : null}
										<Textarea
											id={`item-${item.id}-input`}
											value={answer?.textValue ?? ""}
											onChange={(e) => changeText(item.id, e.target.value)}
											rows={item.type === "long_text" ? 5 : 2}
											maxLength={item.maxLength}
											aria-labelledby={`item-${item.id}-prompt`}
											aria-invalid={isMissing || undefined}
											aria-describedby={
												[
													item.helperText ? `item-${item.id}-help` : null,
													isMissing ? errorId : null,
												]
													.filter(Boolean)
													.join(" ") || undefined
											}
											className="min-h-11"
										/>
									</div>
								)}

							{isMissing && (
								<p id={errorId} role="alert" className="mt-2 text-xs text-destructive">
									Please answer this one.
								</p>
							)}
							</CardContent>
							</Card>
						</li>
					);
				})}
			</ol>

		<div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
				<div className="mx-auto max-w-xl space-y-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription id="submit-error">{error}</AlertDescription>
						</Alert>
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
							You have answered {answered} of {total} items. After you submit,
							responses cannot be changed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Keep reviewing</AlertDialogCancel>
						<AlertDialogAction disabled={busy} onClick={() => void confirmSubmit()}>
							{busy ? "Submitting…" : "Submit assessment"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</CandidateShell>
	);
}

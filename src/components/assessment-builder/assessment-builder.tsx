"use client";

import {
	ArrowDownIcon,
	ArrowUpIcon,
	FileTextIcon,
	InfoIcon,
	ListChecksIcon,
	MoreHorizontalIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { LIKERT_LABELS } from "@/lib/instrument-labels";
import type { DraftInstrumentDocument, PublishIssue } from "@/lib/instrument-draft";
import { cn } from "@/lib/utils";

type DraftItem = DraftInstrumentDocument["items"][number];
type DraftSection = DraftInstrumentDocument["sections"][number];
type DraftDimension = DraftInstrumentDocument["dimensions"][number];
type ItemType = DraftItem["type"];

type Selection =
	| { kind: "overview" }
	| { kind: "section"; sectionId: string }
	| { kind: "item"; itemId: string };

type PendingDelete =
	| { kind: "section"; id: string; label: string }
	| { kind: "item"; id: string; label: string }
	| { kind: "dimension"; id: string; label: string };

type SaveState = "saved" | "saving" | "error";

const SAVE_DEBOUNCE_MS = 800;

const ITEM_TYPE_LABEL: Record<ItemType, string> = {
	likert: "Likert scale",
	short_text: "Short text",
	long_text: "Long text",
	info: "Info block",
};

function newId(prefix: string): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Date.now()}`;
}

function itemPreviewText(item: DraftItem): string {
	if (item.type === "info") return item.body || "Untitled info block";
	return item.text || "Untitled item";
}

function ItemTypeIcon({ type, className }: { type: ItemType; className?: string }) {
	if (type === "likert") return <ListChecksIcon className={className} aria-hidden="true" />;
	if (type === "info") return <InfoIcon className={className} aria-hidden="true" />;
	return <FileTextIcon className={className} aria-hidden="true" />;
}

function SaveStatusBadge({ state }: { state: SaveState }) {
	if (state === "saving") {
		return (
			<Badge variant="outline" className="border-border text-muted-foreground">
				Saving…
			</Badge>
		);
	}
	if (state === "error") {
		return <Badge variant="destructive">Save failed</Badge>;
	}
	return (
		<Badge variant="outline" className="border-border text-muted-foreground">
			Saved
		</Badge>
	);
}

/**
 * Delivery 2 visual builder (D18 §8). Autosaves the full draft document on every edit
 * (title included, since the PATCH route derives the assessment's display title from
 * `draftDocument.title`). Publishing and validating always flush the pending save first
 * so the server never scores or freezes anything older than what is on screen.
 */
export function AssessmentBuilder({
	assessmentId,
	initialTitle,
	initialDraft,
	isSystem,
	latestVersionNumber,
}: {
	assessmentId: string;
	initialTitle: string;
	initialDraft: DraftInstrumentDocument;
	isSystem: boolean;
	latestVersionNumber: number | null;
}) {
	const router = useRouter();

	// The assessment's display title can briefly diverge from draftDocument.title (e.g. a
	// draft created before a title was ever typed into it) — fall back to the persisted
	// title so the header never shows a blank field on first paint.
	const [draft, setDraft] = useState<DraftInstrumentDocument>(() => ({
		...initialDraft,
		title: initialDraft.title || initialTitle,
	}));
	const [selection, setSelection] = useState<Selection>({ kind: "overview" });
	const [mobileTab, setMobileTab] = useState<"structure" | "editor" | "settings">("structure");

	const [saveState, setSaveState] = useState<SaveState>("saved");
	const draftRef = useRef(draft);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const skipFirstSave = useRef(true);

	const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
	const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
	const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

	const [validating, setValidating] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [overflowBusy, setOverflowBusy] = useState<"duplicate" | "template" | "archive" | null>(
		null,
	);
	const [actionError, setActionError] = useState<string | null>(null);
	const [validateOpen, setValidateOpen] = useState(false);
	const [validateResult, setValidateResult] = useState<{
		ok: boolean;
		issues: PublishIssue[];
	} | null>(null);

	async function persist() {
		setSaveState("saving");
		try {
			const response = await fetch(`/api/admin/assessments/${assessmentId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ draftDocument: draftRef.current }),
			});
			if (!response.ok) throw new Error("save failed");
			setSaveState("saved");
		} catch {
			setSaveState("error");
		}
	}

	useEffect(() => {
		draftRef.current = draft;
		if (skipFirstSave.current) {
			skipFirstSave.current = false;
			return;
		}
		setSaveState("saving");
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			saveTimer.current = null;
			void persist();
		}, SAVE_DEBOUNCE_MS);
		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- persist reads draftRef, not draft
	}, [draft]);

	async function flushSave() {
		if (saveTimer.current) {
			clearTimeout(saveTimer.current);
			saveTimer.current = null;
		}
		await persist();
	}

	const sortedSections = useMemo(
		() => [...draft.sections].sort((a, b) => a.order - b.order),
		[draft.sections],
	);
	const sortedDimensions = useMemo(
		() => [...draft.dimensions].sort((a, b) => a.order - b.order),
		[draft.dimensions],
	);
	const itemsById = useMemo(() => new Map(draft.items.map((item) => [item.id, item])), [
		draft.items,
	]);

	const selectedSection: DraftSection | null =
		selection.kind === "section"
			? draft.sections.find((s) => s.id === selection.sectionId) ?? null
			: null;
	const selectedItem: DraftItem | null =
		selection.kind === "item" ? itemsById.get(selection.itemId) ?? null : null;
	const selectedItemSectionId: string | null = selectedItem
		? draft.sections.find((s) => s.itemIds.includes(selectedItem.id))?.id ?? null
		: null;

	function selectSection(id: string) {
		setSelection({ kind: "section", sectionId: id });
		setMobileTab("editor");
	}
	function selectItem(id: string) {
		setSelection({ kind: "item", itemId: id });
		setMobileTab("editor");
	}

	// --- Sections ---------------------------------------------------------

	function addSection() {
		const id = newId("sec");
		setDraft((d) => ({
			...d,
			sections: [
				...d.sections,
				{ id, title: `Section ${d.sections.length + 1}`, order: d.sections.length, itemIds: [] },
			],
		}));
		selectSection(id);
	}

	function updateSection(id: string, patch: Partial<DraftSection>) {
		setDraft((d) => ({
			...d,
			sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
		}));
	}

	function moveSection(id: string, direction: -1 | 1) {
		setDraft((d) => {
			const sorted = [...d.sections].sort((a, b) => a.order - b.order);
			const idx = sorted.findIndex((s) => s.id === id);
			const swapIdx = idx + direction;
			if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return d;
			const reordered = [...sorted];
			const tmp = reordered[idx]!;
			reordered[idx] = reordered[swapIdx]!;
			reordered[swapIdx] = tmp;
			return { ...d, sections: reordered.map((s, i) => ({ ...s, order: i })) };
		});
	}

	function requestDeleteSection(section: DraftSection) {
		setPendingDelete({
			kind: "section",
			id: section.id,
			label: section.title.trim() || "this section",
		});
	}

	// --- Items -------------------------------------------------------------

	function addItem(sectionId: string, type: ItemType) {
		const id = newId("item");
		setDraft((d) => {
			let item: DraftItem;
			if (type === "likert") {
				item = {
					type: "likert",
					id,
					text: "",
					required: true,
					min: 1,
					max: 5,
					labels: [...LIKERT_LABELS],
					scored: true,
					dimensionId: d.dimensions[0]?.id ?? null,
					reverseScored: false,
				};
			} else if (type === "info") {
				item = { type: "info", id, body: "" };
			} else {
				item = { type, id, text: "", required: true };
			}
			return {
				...d,
				items: [...d.items, item],
				sections: d.sections.map((s) =>
					s.id === sectionId ? { ...s, itemIds: [...s.itemIds, id] } : s,
				),
			};
		});
		selectItem(id);
	}

	function updateItem(id: string, patch: Record<string, unknown>) {
		setDraft((d) => ({
			...d,
			items: d.items.map((item) => (item.id === id ? ({ ...item, ...patch } as DraftItem) : item)),
		}));
	}

	function moveItem(sectionId: string, itemId: string, direction: -1 | 1) {
		setDraft((d) => ({
			...d,
			sections: d.sections.map((s) => {
				if (s.id !== sectionId) return s;
				const idx = s.itemIds.indexOf(itemId);
				const swapIdx = idx + direction;
				if (idx < 0 || swapIdx < 0 || swapIdx >= s.itemIds.length) return s;
				const ids = [...s.itemIds];
				const tmp = ids[idx]!;
				ids[idx] = ids[swapIdx]!;
				ids[swapIdx] = tmp;
				return { ...s, itemIds: ids };
			}),
		}));
	}

	function requestDeleteItem(item: DraftItem) {
		setPendingDelete({ kind: "item", id: item.id, label: itemPreviewText(item) });
	}

	// --- Dimensions ----------------------------------------------------------

	function addDimension() {
		setDraft((d) => {
			const order = d.dimensions.length;
			return {
				...d,
				dimensions: [
					...d.dimensions,
					{ id: newId("dim"), code: `DIM${order + 1}`, name: `Dimension ${order + 1}`, description: "", order },
				],
			};
		});
	}

	function updateDimension(id: string, patch: Partial<DraftDimension>) {
		setDraft((d) => ({
			...d,
			dimensions: d.dimensions.map((dim) => (dim.id === id ? { ...dim, ...patch } : dim)),
		}));
	}

	function requestDeleteDimension(dimension: DraftDimension) {
		setPendingDelete({
			kind: "dimension",
			id: dimension.id,
			label: dimension.name.trim() || dimension.code,
		});
	}

	function confirmPendingDelete() {
		if (!pendingDelete) return;
		if (pendingDelete.kind === "section") {
			setDraft((d) => {
				const section = d.sections.find((s) => s.id === pendingDelete.id);
				const removeIds = new Set(section?.itemIds ?? []);
				return {
					...d,
					sections: d.sections
						.filter((s) => s.id !== pendingDelete.id)
						.map((s, i) => ({ ...s, order: i })),
					items: d.items.filter((i) => !removeIds.has(i.id)),
				};
			});
			if (selection.kind === "section" && selection.sectionId === pendingDelete.id) {
				setSelection({ kind: "overview" });
			}
		} else if (pendingDelete.kind === "item") {
			setDraft((d) => ({
				...d,
				items: d.items.filter((i) => i.id !== pendingDelete.id),
				sections: d.sections.map((s) => ({
					...s,
					itemIds: s.itemIds.filter((id) => id !== pendingDelete.id),
				})),
			}));
			if (selection.kind === "item" && selection.itemId === pendingDelete.id) {
				setSelection({ kind: "overview" });
			}
		} else {
			setDraft((d) => ({
				...d,
				dimensions: d.dimensions
					.filter((dim) => dim.id !== pendingDelete.id)
					.map((dim, i) => ({ ...dim, order: i })),
				items: d.items.map((item) =>
					item.type === "likert" && item.dimensionId === pendingDelete.id
						? { ...item, dimensionId: null }
						: item,
				),
			}));
		}
		setPendingDelete(null);
	}

	// --- Actions ------------------------------------------------------------

	async function runValidate() {
		setActionError(null);
		await flushSave();
		setValidating(true);
		try {
			const response = await fetch(`/api/admin/assessments/${assessmentId}/validate`, {
				method: "POST",
			});
			const body = await response.json().catch(() => ({}));
			setValidateResult({
				ok: Boolean(body.ok),
				issues: Array.isArray(body.issues) ? body.issues : [],
			});
		} catch {
			setValidateResult({
				ok: false,
				issues: [{ level: "error", code: "network", message: "Could not reach the server." }],
			});
		} finally {
			setValidating(false);
			setValidateOpen(true);
		}
	}

	async function runPublish() {
		setActionError(null);
		setPublishConfirmOpen(false);
		await flushSave();
		setPublishing(true);
		try {
			const response = await fetch(`/api/admin/assessments/${assessmentId}/publish`, {
				method: "POST",
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				setValidateResult({
					ok: false,
					issues: Array.isArray(body.issues)
						? body.issues
						: [{ level: "error", code: "publish", message: body.error ?? "Publish failed." }],
				});
				setValidateOpen(true);
				return;
			}
			router.push(`/admin/assessments/${assessmentId}`);
		} catch {
			setValidateResult({
				ok: false,
				issues: [{ level: "error", code: "network", message: "Could not reach the server." }],
			});
			setValidateOpen(true);
		} finally {
			setPublishing(false);
		}
	}

	async function handleDuplicate(asTemplate: boolean) {
		setActionError(null);
		setOverflowBusy(asTemplate ? "template" : "duplicate");
		try {
			const response = await fetch("/api/admin/assessments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromAssessmentId: assessmentId, asTemplate }),
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body.id) {
				setActionError(body.error ?? "Could not duplicate this assessment.");
				setOverflowBusy(null);
				return;
			}
			router.push(`/admin/assessments/${body.id}/edit`);
		} catch {
			setActionError("Could not reach the server.");
			setOverflowBusy(null);
		}
	}

	async function handleArchive() {
		setActionError(null);
		setOverflowBusy("archive");
		try {
			const response = await fetch(`/api/admin/assessments/${assessmentId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "ARCHIVED" }),
			});
			if (response.ok) {
				router.push("/admin/assessments");
				return;
			}
			const body = await response.json().catch(() => ({}));
			setActionError(body.error ?? "Could not archive this assessment.");
		} catch {
			setActionError("Could not reach the server.");
		} finally {
			setOverflowBusy(null);
			setArchiveConfirmOpen(false);
		}
	}

	// --- Panels --------------------------------------------------------------

	const structureContent = (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				onClick={() => {
					setSelection({ kind: "overview" });
					setMobileTab("editor");
				}}
				className={cn(
					"rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
					selection.kind === "overview"
						? "border-primary/40 bg-primary/5 text-foreground"
						: "border-border bg-transparent text-muted-foreground hover:bg-muted",
				)}
			>
				Overview &amp; consent
				<span className="mt-0.5 block text-xs font-normal text-muted-foreground">
					Intro, consent copy, dimensions
				</span>
			</button>

			<div className="flex flex-col gap-2">
				{sortedSections.map((section, index) => (
					<div key={section.id} className="flex flex-col gap-1">
						<div
							className={cn(
								"flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors",
								selection.kind === "section" && selection.sectionId === section.id
									? "border-primary/40 bg-primary/5"
									: "border-border",
							)}
						>
							<button
								type="button"
								onClick={() => selectSection(section.id)}
								className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground"
							>
								{section.title.trim() || `Section ${index + 1}`}
								<span className="ml-1.5 text-xs font-normal text-muted-foreground">
									{section.itemIds.length} item{section.itemIds.length === 1 ? "" : "s"}
								</span>
							</button>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="Move section up"
								disabled={index === 0}
								onClick={() => moveSection(section.id, -1)}
							>
								<ArrowUpIcon />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label="Move section down"
								disabled={index === sortedSections.length - 1}
								onClick={() => moveSection(section.id, 1)}
							>
								<ArrowDownIcon />
							</Button>
						</div>

						<ul className="ml-2 flex flex-col gap-0.5 border-l border-border pl-2">
							{section.itemIds.map((itemId, itemIndex) => {
								const item = itemsById.get(itemId);
								if (!item) return null;
								return (
									<li key={itemId} className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => selectItem(itemId)}
											className={cn(
												"flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
												selection.kind === "item" && selection.itemId === itemId
													? "bg-primary/10 text-foreground"
													: "text-muted-foreground hover:bg-muted hover:text-foreground",
											)}
										>
											<ItemTypeIcon type={item.type} className="size-3.5 shrink-0" />
											<span className="min-w-0 truncate">{itemPreviewText(item)}</span>
										</button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label="Move item up"
											disabled={itemIndex === 0}
											onClick={() => moveItem(section.id, itemId, -1)}
										>
											<ArrowUpIcon />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label="Move item down"
											disabled={itemIndex === section.itemIds.length - 1}
											onClick={() => moveItem(section.id, itemId, 1)}
										>
											<ArrowDownIcon />
										</Button>
									</li>
								);
							})}
						</ul>

						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="xs"
										className="ml-2 w-fit text-muted-foreground"
									/>
								}
							>
								<PlusIcon />
								Add item
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem onClick={() => addItem(section.id, "likert")}>
									Likert scale
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => addItem(section.id, "short_text")}>
									Short text
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => addItem(section.id, "long_text")}>
									Long text
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => addItem(section.id, "info")}>
									Info block
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				))}
			</div>

			<Button type="button" variant="outline" size="sm" onClick={addSection}>
				<PlusIcon />
				Add section
			</Button>
		</div>
	);

	const editorContent = (
		<div className="flex flex-col gap-4">
			{selection.kind === "overview" && (
				<OverviewEditor draft={draft} setDraft={setDraft} />
			)}
			{selection.kind === "section" && selectedSection && (
				<SectionEditor
					section={selectedSection}
					onChange={(patch) => updateSection(selectedSection.id, patch)}
				/>
			)}
			{selection.kind === "item" && selectedItem && (
				<ItemEditor item={selectedItem} onChange={(patch) => updateItem(selectedItem.id, patch)} />
			)}
			{selection.kind === "section" && !selectedSection && (
				<EmptySelectionNotice text="This section no longer exists." />
			)}
			{selection.kind === "item" && !selectedItem && (
				<EmptySelectionNotice text="This item no longer exists." />
			)}
		</div>
	);

	const configContent = (
		<div className="flex flex-col gap-4">
			{selection.kind === "overview" && (
				<DimensionsPanel
					dimensions={sortedDimensions}
					onAdd={addDimension}
					onChange={updateDimension}
					onDelete={requestDeleteDimension}
				/>
			)}
			{selection.kind === "section" && selectedSection && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Section</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<p className="text-sm text-muted-foreground">
							{selectedSection.itemIds.length} item
							{selectedSection.itemIds.length === 1 ? "" : "s"} in this section.
						</p>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => requestDeleteSection(selectedSection)}
						>
							<TrashIcon />
							Delete section
						</Button>
					</CardContent>
				</Card>
			)}
			{selection.kind === "item" && selectedItem && (
				<ItemConfig
					item={selectedItem}
					dimensions={sortedDimensions}
					onChange={(patch) => updateItem(selectedItem.id, patch)}
					onDelete={() => requestDeleteItem(selectedItem)}
					onMoveUp={
						selectedItemSectionId
							? () => moveItem(selectedItemSectionId, selectedItem.id, -1)
							: undefined
					}
					onMoveDown={
						selectedItemSectionId
							? () => moveItem(selectedItemSectionId, selectedItem.id, 1)
							: undefined
					}
				/>
			)}
			{selection.kind === "item" && !selectedItem && (
				<EmptySelectionNotice text="This item no longer exists." />
			)}
			{selection.kind === "section" && !selectedSection && (
				<EmptySelectionNotice text="This section no longer exists." />
			)}
		</div>
	);

	return (
		<div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col">
			<div className="flex flex-col gap-4 border-b border-border p-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 flex-1">
						<p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
							Assessment builder
						</p>
						<Input
							aria-label="Assessment title"
							value={draft.title}
							onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
							placeholder="Untitled assessment"
							className="h-auto border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
						/>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
							<SaveStatusBadge state={saveState} />
							<span aria-hidden="true">·</span>
							<span>
								{latestVersionNumber !== null
									? `Published v${latestVersionNumber}`
									: "Not yet published"}
							</span>
							{isSystem && <Badge variant="outline">System</Badge>}
						</div>
					</div>

					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							nativeButton={false}
							render={
								<Link
									href={`/admin/assessments/${assessmentId}/preview`}
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => void flushSave()}
								/>
							}
						>
							Preview
						</Button>
						<Button variant="outline" size="sm" disabled={validating} onClick={runValidate}>
							{validating ? "Validating…" : "Validate"}
						</Button>
						<Button size="sm" disabled={publishing} onClick={() => setPublishConfirmOpen(true)}>
							{publishing ? "Publishing…" : "Publish"}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button variant="ghost" size="icon" aria-label="More actions" />}
							>
								<MoreHorizontalIcon />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									disabled={overflowBusy !== null}
									onClick={() => void handleDuplicate(false)}
								>
									Duplicate
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={overflowBusy !== null}
									onClick={() => void handleDuplicate(true)}
								>
									Save as template
								</DropdownMenuItem>
								{!isSystem && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											disabled={overflowBusy !== null}
											onClick={() => setArchiveConfirmOpen(true)}
										>
											Archive
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{actionError && (
					<p role="alert" className="text-sm text-destructive">
						{actionError}
					</p>
				)}

				<p className="max-w-3xl rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
					This builder does not psychometrically validate items, dimensions, or scoring.
					Reverse-scoring and banding are arithmetic only — they do not establish reliability or
					validity. Have a qualified professional review any new or edited instrument before it
					informs a hiring decision.
				</p>
			</div>

			{/* Desktop: three-region layout, left/right rails pinned while the center scrolls
			    with the page. Mobile: identical content, presented as tabs instead. */}
			<div className="hidden gap-6 p-6 lg:grid lg:grid-cols-[280px_1fr_320px] lg:items-start">
				<div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto rounded-lg border border-border p-4">
					{structureContent}
				</div>
				<div className="min-w-0">{editorContent}</div>
				<div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto rounded-lg border border-border p-4">
					{configContent}
				</div>
			</div>

			<div className="p-4 lg:hidden">
				<Tabs value={mobileTab} onValueChange={(v) => v && setMobileTab(v as typeof mobileTab)}>
					<TabsList className="w-full">
						<TabsTrigger value="structure" className="flex-1">
							Structure
						</TabsTrigger>
						<TabsTrigger value="editor" className="flex-1">
							Editor
						</TabsTrigger>
						<TabsTrigger value="settings" className="flex-1">
							Settings
						</TabsTrigger>
					</TabsList>
					<TabsContent value="structure" className="mt-4">
						{structureContent}
					</TabsContent>
					<TabsContent value="editor" className="mt-4">
						{editorContent}
					</TabsContent>
					<TabsContent value="settings" className="mt-4">
						{configContent}
					</TabsContent>
				</Tabs>
			</div>

			{/* Delete confirmation — shared across sections, items, and dimensions so every
			    destructive structural edit gets the same guardrail. */}
			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => !open && setPendingDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {pendingDelete?.kind === "section" ? "this section" : pendingDelete?.kind === "item" ? "this item" : "this dimension"}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingDelete?.kind === "section" &&
								`"${pendingDelete.label}" and every item inside it will be removed from the draft. This cannot be undone.`}
							{pendingDelete?.kind === "item" &&
								`"${pendingDelete.label}" will be removed from its section. This cannot be undone.`}
							{pendingDelete?.kind === "dimension" &&
								`Likert items scored against "${pendingDelete.label}" will be unassigned, not deleted. This cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={confirmPendingDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Publish this draft?</AlertDialogTitle>
						<AlertDialogDescription>
							This freezes the current draft as a new, immutable version
							{latestVersionNumber !== null ? ` (v${latestVersionNumber + 1})` : " (v1)"}. The
							draft clears once published — you can start a new one from the published version
							at any time.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={publishing}>Keep editing</AlertDialogCancel>
						<AlertDialogAction disabled={publishing} onClick={() => void runPublish()}>
							{publishing ? "Publishing…" : "Publish"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Archive this assessment?</AlertDialogTitle>
						<AlertDialogDescription>
							It becomes read-only history. Rounds already using a published version keep
							working; new rounds cannot select it.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={overflowBusy === "archive"}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={overflowBusy === "archive"}
							onClick={() => void handleArchive()}
						>
							{overflowBusy === "archive" ? "Archiving…" : "Archive"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={validateOpen} onOpenChange={setValidateOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{validateResult?.ok ? "No blocking issues" : "Validation results"}
						</DialogTitle>
						<DialogDescription>
							{validateResult?.ok
								? "This draft can be published as-is. Review any warnings below first."
								: "Fix the errors below before publishing."}
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-80 overflow-y-auto">
						{validateResult && validateResult.issues.length === 0 ? (
							<p className="text-sm text-muted-foreground">No errors or warnings.</p>
						) : (
							<ul className="flex flex-col gap-2">
								{validateResult?.issues.map((issue, i) => (
									<li
										key={`${issue.code}-${i}`}
										className={cn(
											"rounded-md border px-3 py-2 text-sm",
											issue.level === "error"
												? "border-destructive/30 bg-destructive/5 text-destructive"
												: "border-border bg-muted/40 text-muted-foreground",
										)}
									>
										<span className="font-medium">
											{issue.level === "error" ? "Error" : "Warning"}:
										</span>{" "}
										{issue.message}
									</li>
								))}
							</ul>
						)}
					</div>
					<DialogFooter showCloseButton />
				</DialogContent>
			</Dialog>
		</div>
	);
}

function EmptySelectionNotice({ text }: { text: string }) {
	return (
		<div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
			{text}
		</div>
	);
}

function OverviewEditor({
	draft,
	setDraft,
}: {
	draft: DraftInstrumentDocument;
	setDraft: React.Dispatch<React.SetStateAction<DraftInstrumentDocument>>;
}) {
	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Candidate-facing copy</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Label className="flex flex-col gap-1.5">
						Candidate introduction
						<Textarea
							value={draft.candidateIntroduction}
							onChange={(e) =>
								setDraft((d) => ({ ...d, candidateIntroduction: e.target.value }))
							}
							placeholder="What this assessment is about, in plain language."
							rows={3}
						/>
					</Label>
					<div className="grid gap-4 sm:grid-cols-2">
						<Label className="flex flex-col gap-1.5">
							Estimated minutes
							<Input
								type="number"
								min={1}
								value={draft.estimatedMinutes}
								onChange={(e) =>
									setDraft((d) => ({ ...d, estimatedMinutes: Number(e.target.value) || 0 }))
								}
							/>
						</Label>
						<Label className="flex flex-col gap-1.5">
							Display mode
							<Select
								value={draft.displayMode}
								onValueChange={(v) =>
									v && setDraft((d) => ({ ...d, displayMode: v as "continuous" | "section" }))
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="continuous">Continuous (one long page)</SelectItem>
									<SelectItem value="section">By section</SelectItem>
								</SelectContent>
							</Select>
						</Label>
					</div>
					<Label className="flex flex-col gap-1.5">
						Internal description
						<Textarea
							value={draft.internalDescription ?? ""}
							onChange={(e) => setDraft((d) => ({ ...d, internalDescription: e.target.value }))}
							placeholder="Notes for other admins — never shown to candidates."
							rows={2}
						/>
					</Label>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Consent</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Label className="flex flex-col gap-1.5">
						Purpose
						<Textarea
							value={draft.consent.purpose}
							onChange={(e) =>
								setDraft((d) => ({ ...d, consent: { ...d.consent, purpose: e.target.value } }))
							}
							rows={2}
						/>
					</Label>
					<Label className="flex flex-col gap-1.5">
						What we collect
						<Textarea
							value={draft.consent.whatWeCollect}
							onChange={(e) =>
								setDraft((d) => ({
									...d,
									consent: { ...d.consent, whatWeCollect: e.target.value },
								}))
							}
							rows={2}
						/>
					</Label>
					<Label className="flex flex-col gap-1.5">
						Who sees it
						<Textarea
							value={draft.consent.whoSeesIt}
							onChange={(e) =>
								setDraft((d) => ({ ...d, consent: { ...d.consent, whoSeesIt: e.target.value } }))
							}
							rows={2}
						/>
					</Label>
					<Label className="flex flex-col gap-1.5">
						Retention
						<Textarea
							value={draft.consent.retention}
							onChange={(e) =>
								setDraft((d) => ({
									...d,
									consent: { ...d.consent, retention: e.target.value },
								}))
							}
							rows={2}
						/>
						<span className="text-xs text-muted-foreground">
							Use <code>{"{RETENTION_DAYS}"}</code> where the retention period should be
							interpolated at render.
						</span>
					</Label>
				</CardContent>
			</Card>
		</>
	);
}

function DimensionsPanel({
	dimensions,
	onAdd,
	onChange,
	onDelete,
}: {
	dimensions: DraftDimension[];
	onAdd: () => void;
	onChange: (id: string, patch: Partial<DraftDimension>) => void;
	onDelete: (dimension: DraftDimension) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Dimensions</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{dimensions.length === 0 && (
					<p className="text-sm text-muted-foreground">No dimensions yet.</p>
				)}
				{dimensions.map((dim) => (
					<div key={dim.id} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
						<div className="flex items-center gap-1.5">
							<Input
								aria-label="Dimension code"
								value={dim.code}
								onChange={(e) => onChange(dim.id, { code: e.target.value })}
								className="h-7 w-20 text-xs"
							/>
							<Input
								aria-label="Dimension name"
								value={dim.name}
								onChange={(e) => onChange(dim.id, { name: e.target.value })}
								className="h-7 flex-1 text-xs"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label={`Delete dimension ${dim.name}`}
								onClick={() => onDelete(dim)}
							>
								<TrashIcon />
							</Button>
						</div>
					</div>
				))}
				<Button type="button" variant="outline" size="sm" onClick={onAdd}>
					<PlusIcon />
					Add dimension
				</Button>
			</CardContent>
		</Card>
	);
}

function SectionEditor({
	section,
	onChange,
}: {
	section: DraftSection;
	onChange: (patch: Partial<DraftSection>) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Section</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Label className="flex flex-col gap-1.5">
					Title
					<Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} />
				</Label>
				<Label className="flex flex-col gap-1.5">
					Introduction
					<Textarea
						value={section.introduction ?? ""}
						onChange={(e) => onChange({ introduction: e.target.value })}
						placeholder="Optional text shown above this section's items."
						rows={3}
					/>
				</Label>
			</CardContent>
		</Card>
	);
}

function ItemEditor({
	item,
	onChange,
}: {
	item: DraftItem;
	onChange: (patch: Record<string, unknown>) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">{ITEM_TYPE_LABEL[item.type]}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{item.type === "info" ? (
					<Label className="flex flex-col gap-1.5">
						Info text
						<Textarea
							value={item.body}
							onChange={(e) => onChange({ body: e.target.value })}
							placeholder="Instructional text shown to the candidate — not answerable."
							rows={4}
						/>
					</Label>
				) : (
					<Label className="flex flex-col gap-1.5">
						{item.type === "likert" ? "Statement text" : "Question"}
						<Textarea
							value={item.text}
							onChange={(e) => onChange({ text: e.target.value })}
							rows={3}
						/>
					</Label>
				)}
				{item.type === "likert" && (
					<div>
						<p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Scale (fixed 1–5)
						</p>
						<ol className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
							{item.labels.map((label, i) => (
								<li key={i} className="rounded-full border border-border px-2 py-0.5">
									{i + 1}. {label}
								</li>
							))}
						</ol>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ItemConfig({
	item,
	dimensions,
	onChange,
	onDelete,
	onMoveUp,
	onMoveDown,
}: {
	item: DraftItem;
	dimensions: DraftDimension[];
	onChange: (patch: Record<string, unknown>) => void;
	onDelete: () => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Item settings</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{item.type !== "info" && (
					<Label className="flex items-center gap-2 text-sm font-medium">
						<Checkbox
							checked={item.required}
							onCheckedChange={(v) => onChange({ required: v === true })}
						/>
						Required
					</Label>
				)}

				{item.type === "likert" && (
					<>
						<Label className="flex items-center gap-2 text-sm font-medium">
							<Checkbox
								checked={item.scored}
								onCheckedChange={(v) => onChange({ scored: v === true })}
							/>
							Scored
						</Label>
						<Label className="flex flex-col gap-1.5">
							Dimension
							<Select
								value={item.dimensionId ?? "none"}
								onValueChange={(v) => onChange({ dimensionId: v === "none" ? null : v })}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{dimensions.map((dim) => (
										<SelectItem key={dim.id} value={dim.id}>
											{dim.code} — {dim.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{item.scored && !item.dimensionId && (
								<span className="text-xs text-destructive">
									A scored item needs a dimension to publish.
								</span>
							)}
						</Label>
						<Label className="flex items-center gap-2 text-sm font-medium">
							<Checkbox
								checked={item.reverseScored}
								onCheckedChange={(v) => onChange({ reverseScored: v === true })}
							/>
							Reverse scored
						</Label>
					</>
				)}

				{(item.type === "short_text" || item.type === "long_text") && (
					<>
						<Label className="flex flex-col gap-1.5">
							Helper text
							<Input
								value={item.helperText ?? ""}
								onChange={(e) => onChange({ helperText: e.target.value || undefined })}
								placeholder="Optional hint shown under the field."
							/>
						</Label>
						<Label className="flex flex-col gap-1.5">
							Max length
							<Input
								type="number"
								min={1}
								value={item.maxLength ?? ""}
								onChange={(e) =>
									onChange({
										maxLength: e.target.value ? Number(e.target.value) : undefined,
									})
								}
								placeholder="No limit"
							/>
						</Label>
					</>
				)}

				{item.type === "info" && (
					<p className="text-sm text-muted-foreground">
						Info blocks are not answerable and are never scored.
					</p>
				)}

				<div className="flex flex-wrap gap-2 border-t border-border pt-3">
					{(onMoveUp || onMoveDown) && (
						<>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!onMoveUp}
								onClick={onMoveUp}
							>
								<ArrowUpIcon />
								Move up
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!onMoveDown}
								onClick={onMoveDown}
							>
								<ArrowDownIcon />
								Move down
							</Button>
						</>
					)}
					<Button type="button" variant="destructive" size="sm" onClick={onDelete}>
						<TrashIcon />
						Delete
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

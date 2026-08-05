import { ChevronLeftIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidatePreviewFrame } from "@/components/candidate/shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { parseDraftDocument, type DraftInstrumentDocument } from "@/lib/instrument-draft";
import { LIKERT_LABELS } from "@/lib/instrument-labels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PreviewItem = DraftInstrumentDocument["items"][number];
type PreviewSection = DraftInstrumentDocument["sections"][number];

type PreviewRow = {
	section: PreviewSection;
	item: PreviewItem;
	/** True for the first row of each section, so the header prints once per section. */
	isFirstInSection: boolean;
};

/** Section order, then item order within — same walk as `orderedAllItems`, but over the
 *  lenient draft shape so a not-yet-published draft can be previewed too. */
function orderedItems(doc: DraftInstrumentDocument): PreviewRow[] {
	const byId = new Map(doc.items.map((item) => [item.id, item]));
	const sections = [...doc.sections].sort((a, b) => a.order - b.order);
	const out: PreviewRow[] = [];
	for (const section of sections) {
		let isFirstInSection = true;
		for (const id of section.itemIds) {
			const item = byId.get(id);
			if (item) {
				out.push({ section, item, isFirstInSection });
				isFirstInSection = false;
			}
		}
	}
	return out;
}

/**
 * Candidate-like read-only preview (D18 §8) — renders the draft if one exists, else the
 * latest published version, with none of the assignment side effects of `/a/[token]/*`:
 * no cookie, no token, no row created anywhere. Any hiring user may open it; only ADMIN
 * can change what it shows.
 */
export default async function AssessmentPreviewPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await requireHiringUser();
	const { id } = await params;

	const assessment = await db.assessment.findUnique({
		where: { id },
		include: {
			versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { document: true } },
		},
	});
	if (!assessment) notFound();

	const source = assessment.draftDocument ?? assessment.versions[0]?.document ?? null;

	return (
		<CandidatePreviewFrame>
			<div className="mx-auto max-w-xl px-4 py-6 pb-16">
				<div className="mb-5 flex items-center justify-between gap-3">
					<Button
						variant="ghost"
						size="sm"
						className="-ml-2 gap-1"
						nativeButton={false}
						render={<Link href={`/admin/assessments/${id}/edit`} />}
					>
						<ChevronLeftIcon className="size-4" aria-hidden="true" />
						Back to builder
					</Button>
				</div>
				<Alert className="mb-6 border-dashed">
					<EyeIcon className="size-4" />
					<AlertDescription>
						Preview — not a live invitation. Nothing shown here is saved as a response, and no
						candidate link is created.
					</AlertDescription>
				</Alert>

				{!source ? (
					<Card>
						<CardHeader>
							<CardTitle>Nothing to preview yet</CardTitle>
							<CardDescription>
								This assessment has no draft and nothing published. Open the builder to start
								one.
							</CardDescription>
						</CardHeader>
					</Card>
				) : (
					<PreviewBody doc={parseDraftDocument(source)} />
				)}
			</div>
		</CandidatePreviewFrame>
	);
}

function PreviewBody({ doc }: { doc: DraftInstrumentDocument }) {
	const items = orderedItems(doc);
	const answerableCount = items.filter(({ item }) => item.type !== "info").length;
	const retention = doc.consent.retention.replace(
		"{RETENTION_DAYS}",
		String(env.RETENTION_DAYS),
	);

	return (
		<>
			<h1 className="text-xl font-semibold tracking-tight">{doc.title || "Untitled assessment"}</h1>
			{doc.candidateIntroduction && (
				<p className="mt-2 text-sm text-muted-foreground">{doc.candidateIntroduction}</p>
			)}

			<Card className="mt-5 border-border/80 shadow-none">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">At a glance</CardTitle>
					<CardDescription>What a candidate would see before starting.</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="space-y-2 text-sm text-muted-foreground">
						<div className="flex items-center justify-between gap-4">
							<dt>Items to answer</dt>
							<dd className="font-medium text-foreground tabular-nums">
								{answerableCount}
							</dd>
						</div>
						<Separator />
						<div className="flex items-center justify-between gap-4">
							<dt>Estimated time</dt>
							<dd className="font-medium text-foreground tabular-nums">
								About {doc.estimatedMinutes} minutes
							</dd>
						</div>
						<Separator />
						<div className="flex items-center justify-between gap-4">
							<dt>Display mode</dt>
							<dd className="font-medium text-foreground">
								{doc.displayMode === "section" ? "By section" : "Continuous page"}
							</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<div className="mt-6 space-y-5 text-sm leading-relaxed">
				<section>
					<h2 className="font-medium text-foreground">Purpose</h2>
					<p className="mt-1.5 text-muted-foreground">{doc.consent.purpose || "—"}</p>
				</section>
				<section>
					<h2 className="font-medium text-foreground">What we collect</h2>
					<p className="mt-1.5 text-muted-foreground">{doc.consent.whatWeCollect || "—"}</p>
				</section>
				<section>
					<h2 className="font-medium text-foreground">Who sees it</h2>
					<p className="mt-1.5 text-muted-foreground">{doc.consent.whoSeesIt || "—"}</p>
				</section>
				<section>
					<h2 className="font-medium text-foreground">How long we keep it</h2>
					<p className="mt-1.5 text-muted-foreground">{retention || "—"}</p>
				</section>
			</div>

		<ol className="mt-8 space-y-3">
			{items.map(({ section, item, isFirstInSection }, index) => {
				const showSectionHeader = doc.displayMode === "section" && isFirstInSection;
				return (
					<li key={item.id}>
						{showSectionHeader && (
							<div className="mb-3 border-l-2 border-primary pl-3 pt-4 first:pt-0">
								<h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
								{section.introduction && (
									<p className="mt-1 text-xs text-muted-foreground">{section.introduction}</p>
								)}
							</div>
						)}
						<Card className="shadow-none">
							<CardContent className="px-4 py-3">
								<PreviewItemBlock item={item} order={index + 1} />
							</CardContent>
						</Card>
					</li>
				);
			})}
		</ol>
		</>
	);
}

function PreviewItemBlock({ item, order }: { item: PreviewItem; order: number }) {
	if (item.type === "info") {
		return (
			<Card className="border-dashed bg-muted/50 shadow-none">
				<CardContent className="px-3 py-2.5 text-sm italic text-muted-foreground">
					{item.body || "(Empty info block)"}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="py-1">
			<div className="flex items-start gap-2">
				<Badge variant="outline" className="mt-0.5 shrink-0 tabular-nums">
					{order}
				</Badge>
				<p className="text-sm font-medium leading-snug">
					{item.text || "(Empty item)"}
					{item.required && <span className="ml-1 text-muted-foreground">*</span>}
				</p>
			</div>

			{item.type === "likert" && (
				<>
					<div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
						{[1, 2, 3, 4, 5].map((value) => (
							<div
								key={value}
								className="flex h-12 items-center justify-center rounded-md border border-border bg-muted/40 text-sm font-medium text-muted-foreground"
							>
								{value}
							</div>
						))}
					</div>
					<div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
						<span>{item.labels[0] ?? LIKERT_LABELS[0]}</span>
						<span>{item.labels[4] ?? LIKERT_LABELS[4]}</span>
					</div>
				</>
			)}

			{(item.type === "short_text" || item.type === "long_text") && (
				<div
					className={cn(
						"mt-3 w-full rounded-lg border border-dashed border-input bg-muted/20 px-2.5 py-2 text-sm text-muted-foreground",
						item.type === "long_text" && "min-h-20",
					)}
				>
					{item.helperText || "Candidate's answer appears here."}
				</div>
			)}
		</div>
	);
}

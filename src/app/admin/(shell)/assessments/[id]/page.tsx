import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { parseInstrumentDocument } from "@/lib/instrument-document";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
	SYSTEM: "System",
	ORGANISATION: "Organisation",
	TEMPLATE: "Template",
};

/**
 * Read-only preview of the latest published version's frozen document (D18 §8) — no
 * editor. Historical rounds may point at an older version than this one; this page only
 * ever shows the newest published snapshot.
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
			versions: { orderBy: { versionNumber: "desc" }, take: 1 },
		},
	});
	if (!assessment) notFound();

	const latest = assessment.versions[0];

	return (
		<div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 overflow-x-hidden p-6">
			<div>
				<Button
					variant="ghost"
					size="sm"
					className="mb-2 -ml-2"
					nativeButton={false}
					render={<Link href="/admin/assessments" />}
				>
					← Assessments
				</Button>
			</div>

			<PageHeader
				eyebrow="Assessment preview"
				title={assessment.title}
				meta={
					<Badge variant={assessment.kind === "SYSTEM" ? "default" : "secondary"}>
						{KIND_LABEL[assessment.kind] ?? assessment.kind}
					</Badge>
				}
			/>

			{!latest ? (
				<Card>
					<CardHeader>
						<CardTitle>Nothing published yet</CardTitle>
						<CardDescription>
							This assessment has no published version, so there is nothing to preview yet.
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<AssessmentDocumentPreview versionNumber={latest.versionNumber} document={latest.document} />
			)}
		</div>
	);
}

function AssessmentDocumentPreview({
	versionNumber,
	document,
}: {
	versionNumber: number;
	document: unknown;
}) {
	const parsed = parseInstrumentDocument(document);
	const sortedSections = [...parsed.sections].sort((a, b) => a.order - b.order);
	const sortedDimensions = [...parsed.dimensions].sort((a, b) => a.order - b.order);

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Version {versionNumber}</CardTitle>
					<CardDescription>
						{parsed.estimatedMinutes} minute{parsed.estimatedMinutes === 1 ? "" : "s"} estimated ·{" "}
						{parsed.items.length} item{parsed.items.length === 1 ? "" : "s"} ·{" "}
						{sortedSections.length} section{sortedSections.length === 1 ? "" : "s"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-1 text-sm text-muted-foreground">
					<p>
						<span className="font-medium text-foreground">Display mode:</span>{" "}
						{parsed.displayMode === "section" ? "By section" : "Continuous"}
					</p>
					<p>
						<span className="font-medium text-foreground">Candidate introduction:</span>{" "}
						{parsed.candidateIntroduction}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Dimensions</CardTitle>
					<CardDescription>Scored dimensions this version measures.</CardDescription>
				</CardHeader>
				<CardContent className="divide-y">
					{sortedDimensions.map((dim) => (
						<div key={dim.id} className="flex items-center justify-between gap-4 py-2 text-sm">
							<div className="min-w-0">
								<p className="font-medium text-foreground">{dim.name}</p>
								{dim.description && (
									<p className="mt-0.5 text-muted-foreground">{dim.description}</p>
								)}
							</div>
							<Badge variant="outline" className="shrink-0">
								{dim.code}
							</Badge>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Sections</CardTitle>
					<CardDescription>Item order as candidates will see it.</CardDescription>
				</CardHeader>
				<CardContent className="divide-y">
					{sortedSections.map((section) => (
						<div key={section.id} className="py-2 text-sm">
							<p className="font-medium text-foreground">{section.title}</p>
							{section.introduction && (
								<p className="mt-0.5 text-muted-foreground">{section.introduction}</p>
							)}
							<p className="mt-0.5 text-muted-foreground">
								{section.itemIds.length} item{section.itemIds.length === 1 ? "" : "s"}
							</p>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Response-context rules</CardTitle>
					<CardDescription>
						Evaluated from this version&apos;s document only. Never alter dimension scores or reject
						a candidate.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{parsed.responseContextRules.length === 0 ? (
						<p className="text-sm text-muted-foreground">No response-context rules configured.</p>
					) : (
						<ul className="space-y-2 text-sm">
							{parsed.responseContextRules.map((rule) => (
								<li key={rule.id} className="flex items-center justify-between gap-4">
									<span className="text-foreground">{rule.label}</span>
									<Badge variant={rule.enabled ? "secondary" : "outline"}>
										{rule.enabled ? "Active" : "Off"}
									</Badge>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</>
	);
}

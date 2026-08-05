import Link from "next/link";
import { DuplicateAssessmentButton, NewAssessmentButton } from "@/components/assessment-builder/assessments-toolbar";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { FileStack } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
	SYSTEM: "System",
	ORGANISATION: "Organisation",
	TEMPLATE: "Template",
};

/**
 * The Delivery 2 builder is live (D18 §8): every assessment can be previewed, edited,
 * and duplicated from here. ADMIN gets the mutating actions (new, edit, duplicate);
 * VIEWER keeps read-only access to preview, matching the rest of the app (D15).
 */
export default async function AssessmentsPage() {
	const session = await requireHiringUser();
	const isAdmin = session.role === "ADMIN";

	const [assessments, roundCounts] = await Promise.all([
		db.assessment.findMany({
			orderBy: { title: "asc" },
			include: {
				versions: {
					orderBy: { versionNumber: "desc" },
					select: { id: true, versionNumber: true },
				},
			},
		}),
		db.hiringRound.groupBy({ by: ["assessmentVersionId"], _count: { _all: true } }),
	]);

	const roundCountByVersionId = new Map(
		roundCounts.map((row) => [row.assessmentVersionId, row._count._all]),
	);

	const rows = assessments.map((assessment) => {
		const latestVersion = assessment.versions[0] ?? null;
		const roundCount = assessment.versions.reduce(
			(sum, v) => sum + (roundCountByVersionId.get(v.id) ?? 0),
			0,
		);
		return {
			id: assessment.id,
			title: assessment.title,
			kind: assessment.kind,
			status: assessment.status,
			latestVersionNumber: latestVersion?.versionNumber ?? null,
			hasDraft: assessment.draftDocument !== null,
			roundCount,
		};
	});

	return (
		<div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6 overflow-x-hidden p-6">
			<PageHeader
				eyebrow="Workspace"
				title="Assessments"
				description="Every instrument in the workspace, its latest published version, and where it is in use. Preview any of them; the visual builder is live for edits, duplicates, and new drafts."
				actions={isAdmin ? <NewAssessmentButton /> : undefined}
			/>

			{rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileStack />
						</EmptyMedia>
						<EmptyTitle>No assessments yet</EmptyTitle>
						<EmptyDescription>
							{isAdmin
								? "Create one to get started, or seed the system assessment — see the backfill script."
								: "Seed the system assessment to get started — see the backfill script."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<Card>
					<CardContent className="space-y-0">
						<div className="hidden min-w-0 overflow-x-auto md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Title</TableHead>
										<TableHead>Kind</TableHead>
										<TableHead>Latest published version</TableHead>
										<TableHead>Draft</TableHead>
										<TableHead className="text-right">Rounds using it</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell className="font-medium">{row.title}</TableCell>
											<TableCell>
												<Badge variant={row.kind === "SYSTEM" ? "default" : "secondary"}>
													{KIND_LABEL[row.kind] ?? row.kind}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{row.latestVersionNumber !== null
													? `v${row.latestVersionNumber}`
													: "Not published"}
											</TableCell>
											<TableCell>
												{row.status === "ARCHIVED" ? (
													<Badge variant="outline">Archived</Badge>
												) : row.hasDraft ? (
													<Badge variant="outline">Draft pending</Badge>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{row.roundCount}
											</TableCell>
											<TableCell className="text-right">
												<AssessmentRowActions
													assessmentId={row.id}
													isAdmin={isAdmin}
													archived={row.status === "ARCHIVED"}
												/>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<ul className="flex flex-col gap-3 md:hidden">
							{rows.map((row) => (
								<li
									key={row.id}
									className="space-y-3 rounded-lg border border-border px-3 py-3"
								>
									<div className="space-y-1">
										<p className="font-medium">{row.title}</p>
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant={row.kind === "SYSTEM" ? "default" : "secondary"}>
												{KIND_LABEL[row.kind] ?? row.kind}
											</Badge>
											{row.status === "ARCHIVED" ? (
												<Badge variant="outline">Archived</Badge>
											) : row.hasDraft ? (
												<Badge variant="outline">Draft pending</Badge>
											) : null}
										</div>
										<p className="text-sm text-muted-foreground">
											{row.latestVersionNumber !== null
												? `Latest published: v${row.latestVersionNumber}`
												: "Not published"}
										</p>
										<p className="text-sm tabular-nums text-muted-foreground">
											{row.roundCount} round{row.roundCount === 1 ? "" : "s"} using it
										</p>
									</div>
									<AssessmentRowActions
										assessmentId={row.id}
										isAdmin={isAdmin}
										archived={row.status === "ARCHIVED"}
									/>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function AssessmentRowActions({
	assessmentId,
	isAdmin,
	archived,
}: {
	assessmentId: string;
	isAdmin: boolean;
	archived: boolean;
}) {
	return (
		<div className="flex flex-wrap gap-2 md:justify-end">
			<Button
				size="sm"
				variant="outline"
				nativeButton={false}
				render={<Link href={`/admin/assessments/${assessmentId}/preview`} />}
			>
				Preview
			</Button>
			{isAdmin && !archived && (
				<>
					<Button
						size="sm"
						variant="outline"
						nativeButton={false}
						render={<Link href={`/admin/assessments/${assessmentId}/edit`} />}
					>
						Edit
					</Button>
					<DuplicateAssessmentButton assessmentId={assessmentId} />
				</>
			)}
		</div>
	);
}

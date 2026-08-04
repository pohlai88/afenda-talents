import Link from "next/link";
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
 * Read-only through Delivery 1 (D18 §8) — no editor, no publish action here. A single
 * status column would be ambiguous while a draft and a published version can coexist,
 * so draft presence gets its own badge instead of folding into one lifecycle word.
 */
export default async function AssessmentsPage() {
	await requireHiringUser();

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
				description="Every instrument in the workspace, its latest published version, and where it is in use. The visual builder ships in Delivery 2 — this list is read-only."
			/>

			{rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileStack />
						</EmptyMedia>
						<EmptyTitle>No assessments yet</EmptyTitle>
						<EmptyDescription>
							Seed the system assessment to get started — see the backfill script.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<Card>
					<CardContent>
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
											{row.latestVersionNumber !== null ? `v${row.latestVersionNumber}` : "Not published"}
										</TableCell>
										<TableCell>
											{row.hasDraft ? (
												<Badge variant="outline">Draft pending</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="text-right tabular-nums">{row.roundCount}</TableCell>
										<TableCell className="text-right">
											{row.latestVersionNumber !== null && (
												<Button
													size="sm"
													variant="outline"
													nativeButton={false}
													render={<Link href={`/admin/assessments/${row.id}`} />}
												>
													Preview
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

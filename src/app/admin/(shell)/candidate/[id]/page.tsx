import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionScale } from "@/components/candidate-detail/dimension-scale";
import { PrintProfileButton } from "@/components/candidate-detail/print-button";
import { CandidateProgressPanel } from "@/components/candidate-detail/progress-panel";
import { ResponseContextPanel } from "@/components/candidate-detail/response-context";
import { CandidateTimeline } from "@/components/candidate-detail/timeline";
import { CandidateAdminMenu } from "@/components/candidates/row-actions";
import { ItemResponsesTable } from "@/components/item-responses-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { audit } from "@/lib/audit";
import { requireHiringUser } from "@/lib/auth-admin";
import { buildCandidateTimeline } from "@/lib/candidate-timeline";
import { db } from "@/lib/db";
import {
	normalizeContextFlags,
	normalizeDimensions,
	type UiContextFlag,
	type UiDimension,
} from "@/lib/result-display";
import { orderedAnswerableItems } from "@/lib/instrument-document";
import { loadVersionDocument } from "@/lib/version-document";

export const dynamic = "force-dynamic";

/**
 * Assignment detail: progress for open statuses, full profile when SCORED.
 *
 * `id` in the URL is the CandidateAssignment id (D18 invite/completion unit).
 * List and overview links must use assignmentId — never the person id alone —
 * so multi-round rows open the matching profile.
 *
 * Framing rules (spec §13.8 / UI §8): one input into a hiring decision — no pass/fail,
 * no ranking, no overall number. Timing is self-reported (D6). Narratives deferred (D17).
 */
export default async function CandidateDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const session = await requireHiringUser();
	const isAdmin = session.role === "ADMIN";
	const { id } = await params;

	const assignment = await db.candidateAssignment.findUnique({
		where: { id },
		include: {
			candidate: true,
			result: true,
			responses: true,
		},
	});
	if (!assignment) notFound();
	const candidate = assignment.candidate;
	const assignmentStatus = assignment.status;

	const versionDoc = await loadVersionDocument(assignment.assessmentVersionId);
	const answerable = orderedAnswerableItems(versionDoc);
	const itemMeta = new Map(
		answerable.map((item, index) => {
			let dimension = "";
			if (item.type === "likert") {
				dimension = item.dimensionId
					? (versionDoc.dimensions.find((d) => d.id === item.dimensionId)?.code ??
						"VAL")
					: "VAL";
			}
			return [
				item.id,
				{
					order: index + 1,
					text: item.type === "info" ? "" : item.text,
					dimension,
				},
			] as const;
		}),
	);

	const [inviter, auditRows] = await Promise.all([
		assignment.invitedById
			? db.user.findUnique({
					where: { id: assignment.invitedById },
					select: { name: true },
				})
			: Promise.resolve(null),
		db.auditEvent.findMany({
			where: {
				subjectId: assignment.id,
				action: { in: ["invite.resent", "invite.revoked"] },
			},
			orderBy: { createdAt: "asc" },
			select: { action: true, createdAt: true },
		}),
	]);

	if (assignment.result) {
		await audit(session.userId, "result.viewed", assignment.id);
	}

	const timeline = buildCandidateTimeline(
		{
			sentAt: assignment.sentAt,
			openedAt: assignment.openedAt,
			consentedAt: assignment.consentedAt,
			startedAt: assignment.startedAt,
			submittedAt: assignment.submittedAt,
			scoredAt: assignment.result?.computedAt ?? null,
		},
		auditRows,
	);

	const answerableIds = new Set(answerable.map((item) => item.id));
	const answeredCount = assignment.responses.filter((r) =>
		answerableIds.has(r.questionId),
	).length;
	const scored = Boolean(assignment.result);

	return (
		<div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 p-6 print:max-w-none print:p-0">
			<div className="print:hidden">
				<Button
					variant="ghost"
					size="sm"
					className="mb-2 -ml-2"
					nativeButton={false}
					render={<Link href="/admin/candidates" />}
				>
					← Back to candidates
				</Button>
			</div>

			<PageHeader
				eyebrow="Candidate record"
				title={candidate.fullName}
				description={candidate.email}
				meta={
					<>
						<StatusBadge status={assignmentStatus} />
						<span className="text-muted-foreground">
							Invited{" "}
							<span className="tabular-nums">
								{assignment.sentAt?.toLocaleDateString("en-GB") ?? "—"}
							</span>
						</span>
						{assignment.submittedAt && (
							<span className="text-muted-foreground">
								Submitted{" "}
								<span className="tabular-nums">
									{assignment.submittedAt.toLocaleDateString("en-GB")}
								</span>
							</span>
						)}
						{inviter?.name && (
							<span className="text-muted-foreground">
								Invited by {inviter.name}
							</span>
						)}
					</>
				}
				actions={
					<div className="flex flex-wrap items-center gap-2 print:hidden">
						{scored && <PrintProfileButton />}
						{isAdmin && (
							<CandidateAdminMenu
								candidateId={candidate.id}
								assignmentId={assignment.id}
								fullName={candidate.fullName}
								status={assignmentStatus}
							/>
						)}
					</div>
				}
			/>

			{scored && assignment.result ? (
				<>
					<p className="rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground print:bg-transparent print:p-0">
						This profile is a self-report and is one input into a hiring
						decision. It is not a test score, a ranking, or a recommendation.
					</p>

					<ScoredProfile
						dimensions={normalizeDimensions(assignment.result.dimensionScores)}
						flags={normalizeContextFlags(assignment.result.validityFlags)}
						totalSeconds={assignment.result.totalSeconds}
						serverWindowSeconds={assignment.result.serverWindowSeconds}
						rows={assignment.responses
							.map((r) => {
								const meta = itemMeta.get(r.questionId);
								return {
									order: meta?.order ?? 0,
									text: meta?.text ?? r.questionId,
									value: r.value ?? r.textValue ?? "",
									dimension: meta?.dimension ?? "",
								};
							})
							.sort((a, b) => a.order - b.order)}
					/>
				</>
			) : (
				<CandidateProgressPanel
					status={assignmentStatus}
					answeredCount={answeredCount}
					totalItems={answerable.length}
				/>
			)}

			<Card className="print:border-0 print:shadow-none">
				<CardHeader>
					<CardTitle>Activity</CardTitle>
					<CardDescription>
						Key events for this invitation. No link secrets are shown.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<CandidateTimeline events={timeline} />
				</CardContent>
			</Card>
		</div>
	);
}

function ScoredProfile({
	dimensions,
	flags,
	totalSeconds,
	serverWindowSeconds,
	rows,
}: {
	dimensions: UiDimension[];
	flags: UiContextFlag[];
	totalSeconds: number;
	serverWindowSeconds: number;
	rows: { order: number; text: string; value: number | string; dimension: string }[];
}) {
	return (
		<>
			<Card className="print:border-0 print:shadow-none">
				<CardHeader>
					<CardTitle>Profile</CardTitle>
					<CardDescription>
						Five dimensions, scaled 0–100, with Developing, Effective, and
						Strong bands. No overall score.
					</CardDescription>
				</CardHeader>
				<CardContent className="divide-y">
					{dimensions.map((d) => (
						<DimensionScale
							key={d.code}
							code={d.code}
							scaled={d.scaled}
							band={d.band}
						/>
					))}
				</CardContent>
			</Card>

			<Card className="print:border-0 print:shadow-none">
				<CardHeader>
					<CardTitle>Response context</CardTitle>
					<CardDescription>
						Context for reading the profile. These do not change any score.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ResponseContextPanel
						flags={flags}
						totalSeconds={totalSeconds}
						serverWindowSeconds={serverWindowSeconds}
					/>
				</CardContent>
			</Card>

			<Card className="print:border-0 print:shadow-none">
				<CardHeader>
					<CardTitle>Responses</CardTitle>
					<CardDescription>
						Item answers grouped by dimension. Collapsed on screen; expanded in
						print.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ItemResponsesTable rows={rows} />
				</CardContent>
			</Card>
		</>
	);
}

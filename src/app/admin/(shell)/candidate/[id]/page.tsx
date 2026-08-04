import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionScale } from "@/components/candidate-detail/dimension-scale";
import { PrintProfileButton } from "@/components/candidate-detail/print-button";
import { CandidateProgressPanel } from "@/components/candidate-detail/progress-panel";
import { ResponseContextPanel } from "@/components/candidate-detail/response-context";
import { CandidateTimeline } from "@/components/candidate-detail/timeline";
import { CandidateRowActions } from "@/components/candidates/row-actions";
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
import type { Band, DimensionScore, ValidityFlag } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/**
 * Candidate detail: progress for open statuses, full profile when SCORED.
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

	const candidate = await db.candidate.findUnique({
		where: { id },
		include: { result: true, responses: { include: { item: true } } },
	});
	if (!candidate) notFound();

	const [inviter, auditRows] = await Promise.all([
		candidate.invitedById
			? db.user.findUnique({
					where: { id: candidate.invitedById },
					select: { name: true },
				})
			: Promise.resolve(null),
		db.auditEvent.findMany({
			where: {
				subjectId: id,
				action: { in: ["invite.resent", "invite.revoked"] },
			},
			orderBy: { createdAt: "asc" },
			select: { action: true, createdAt: true },
		}),
	]);

	if (candidate.result) {
		await audit(session.userId, "result.viewed", id);
	}

	const timeline = buildCandidateTimeline(
		{
			sentAt: candidate.sentAt,
			openedAt: candidate.openedAt,
			consentedAt: candidate.consentedAt,
			startedAt: candidate.startedAt,
			submittedAt: candidate.submittedAt,
			scoredAt: candidate.result?.computedAt ?? null,
		},
		auditRows,
	);

	const answeredCount = candidate.responses.length;
	const scored = Boolean(candidate.result);

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
					← Candidates
				</Button>
			</div>

			<PageHeader
				eyebrow="Candidate record"
				title={candidate.fullName}
				description={candidate.email}
				meta={
					<>
						<StatusBadge status={candidate.status} />
						<span className="text-muted-foreground">
							Invited{" "}
							<span className="tabular-nums">
								{candidate.sentAt?.toLocaleDateString("en-GB") ?? "—"}
							</span>
						</span>
						{candidate.submittedAt && (
							<span className="text-muted-foreground">
								Submitted{" "}
								<span className="tabular-nums">
									{candidate.submittedAt.toLocaleDateString("en-GB")}
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
							<CandidateRowActions
								id={candidate.id}
								fullName={candidate.fullName}
								status={candidate.status}
								showPrimary={false}
							/>
						)}
					</div>
				}
			/>

			{scored && candidate.result ? (
				<>
					<p className="rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground print:bg-transparent print:p-0">
						This profile is a self-report and is one input into a hiring
						decision. It is not a test score, a ranking, or a recommendation.
					</p>

					<ScoredProfile
						dimensions={
							candidate.result.dimensionScores as unknown as DimensionScore[]
						}
						flags={candidate.result.validityFlags as unknown as ValidityFlag[]}
						totalSeconds={candidate.result.totalSeconds}
						serverWindowSeconds={candidate.result.serverWindowSeconds}
						rows={candidate.responses
							.map((r) => ({
								order: r.item.order,
								text: r.item.text,
								value: r.value,
								dimension: r.item.dimension,
							}))
							.sort((a, b) => a.order - b.order)}
					/>
				</>
			) : (
				<CandidateProgressPanel
					status={candidate.status}
					answeredCount={answeredCount}
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
	dimensions: DimensionScore[];
	flags: ValidityFlag[];
	totalSeconds: number;
	serverWindowSeconds: number;
	rows: { order: number; text: string; value: number; dimension: string }[];
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
							band={d.band as Band}
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

import { redirect } from "next/navigation";
import { AuditExplorer } from "@/components/audit/audit-explorer";
import { DangerZone } from "@/components/danger-zone";
import { PageHeader } from "@/components/page-header";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Retention, audit exploration, and purge — kept away from the daily workflow
 * (requirements §11.1). Names for the explorer are resolved from live tables only.
 */
export default async function DataPage() {
	try {
		await requireAdmin();
	} catch {
		redirect("/admin");
	}

	const [events, users, candidates] = await Promise.all([
		db.auditEvent.findMany({
			orderBy: { createdAt: "desc" },
			take: 500,
		}),
		db.user.findMany({ select: { id: true, name: true } }),
		db.candidate.findMany({ select: { id: true, fullName: true } }),
	]);

	const userNames = new Map(users.map((u) => [u.id, u.name]));
	const candidateNames = new Map(candidates.map((c) => [c.id, c.fullName]));

	const rows = events.map((event) => {
		const subjectExists = Boolean(
			event.subjectId && candidateNames.has(event.subjectId),
		);
		return {
			id: event.id,
			action: event.action,
			actorId: event.actor,
			actorName: userNames.get(event.actor) ?? null,
			subjectId: event.subjectId,
			subjectExists,
			subjectLabel: event.subjectId
				? (candidateNames.get(event.subjectId) ?? null)
				: null,
			createdAt: event.createdAt.toISOString(),
			meta: event.meta,
		};
	});

	return (
		<div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-8 overflow-x-hidden p-6">
			<PageHeader
				eyebrow="Workspace"
				title="Data & audit"
				description="What Afenda Talents keeps, for how long, how activity is recorded, and how to delete it."
			/>

			<section aria-labelledby="audit-heading" className="flex flex-col gap-4">
				<div>
					<h2
						id="audit-heading"
						className="text-lg font-semibold tracking-tight"
					>
						Audit activity
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Identifiers and timestamps only in the log. Names below are resolved
						from current records when still available.
					</p>
				</div>
				<Card className="min-w-0">
					<CardContent className="pt-6">
						<AuditExplorer rows={rows} />
					</CardContent>
				</Card>
			</section>

			<section
				aria-labelledby="retention-heading"
				className="flex flex-col gap-4"
			>
				<div>
					<h2
						id="retention-heading"
						className="text-lg font-semibold tracking-tight"
					>
						Data retention and deletion
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Separated from day-to-day hiring work so destructive actions stay
						deliberate.
					</p>
				</div>

				<Card>
					<CardHeader>
						<h3 className="text-base leading-snug font-medium">Retention summary</h3>
						<CardDescription>
							Configured period: {env.RETENTION_DAYS} days from submission.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3 text-sm">
						<ul className="list-inside list-disc space-y-2 text-muted-foreground">
							<li>
								<strong className="font-medium text-foreground">
									Deleted:
								</strong>{" "}
								candidate names, emails, answers, and scored results.
							</li>
							<li>
								<strong className="font-medium text-foreground">Kept:</strong>{" "}
								identity-free audit events (actor id, action, subject id,
								timestamp, non-identifying meta).
							</li>
							<li>
								<strong className="font-medium text-foreground">How:</strong>{" "}
								deletion is manual — nothing expires on its own.
							</li>
						</ul>
						<p className="text-muted-foreground">
							There {candidates.length === 1 ? "is" : "are"} currently{" "}
							<span className="font-medium text-foreground tabular-nums">
								{candidates.length}
							</span>{" "}
							candidate{candidates.length === 1 ? "" : "s"} in this round.
						</p>
					</CardContent>
				</Card>

				<DangerZone
					retentionDays={env.RETENTION_DAYS}
					candidateCount={candidates.length}
				/>
			</section>
		</div>
	);
}

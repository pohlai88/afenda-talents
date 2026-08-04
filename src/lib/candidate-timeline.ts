/**
 * Builds the candidate activity timeline from stored timestamps and invite audit rows.
 *
 * Pure: no Prisma. Callers resolve audit events and pass them in. Token values never
 * appear — only event kinds and times (requirements §8.7).
 */

export type TimelineSource = {
	sentAt: Date | null;
	openedAt: Date | null;
	consentedAt: Date | null;
	startedAt: Date | null;
	submittedAt: Date | null;
	scoredAt: Date | null;
};

export type TimelineAuditEvent = {
	action: string;
	createdAt: Date;
};

export type TimelineEvent = {
	id: string;
	kind:
		| "invited"
		| "opened"
		| "consented"
		| "started"
		| "submitted"
		| "scored"
		| "resent"
		| "revoked";
	label: string;
	at: Date;
};

const LABELS: Record<TimelineEvent["kind"], string> = {
	invited: "Invitation sent",
	opened: "Link opened",
	consented: "Consent given",
	started: "Assessment started",
	submitted: "Assessment submitted",
	scored: "Profile ready for review",
	resent: "Invitation resent",
	revoked: "Invitation revoked",
};

/**
 * Merges candidate lifecycle timestamps with resent/revoked audit events.
 * Same-millisecond consented+started both appear (consent then start) when both exist.
 * Events sort ascending by time; stable kind order breaks ties.
 */
export function buildCandidateTimeline(
	source: TimelineSource,
	auditEvents: TimelineAuditEvent[] = [],
): TimelineEvent[] {
	const events: TimelineEvent[] = [];

	const push = (
		kind: TimelineEvent["kind"],
		at: Date | null,
		idSuffix: string,
	) => {
		if (!at) return;
		events.push({
			id: `${kind}-${idSuffix}`,
			kind,
			label: LABELS[kind],
			at,
		});
	};

	push("invited", source.sentAt, "sent");
	push("opened", source.openedAt, "opened");
	push("consented", source.consentedAt, "consented");
	// If consented and started share a timestamp (common — same request), keep both
	// with distinct ids; sort uses kind order below.
	push("started", source.startedAt, "started");
	push("submitted", source.submittedAt, "submitted");
	push("scored", source.scoredAt, "scored");

	let resentIndex = 0;
	let revokedIndex = 0;
	for (const event of auditEvents) {
		if (event.action === "invite.resent") {
			push("resent", event.createdAt, `audit-${resentIndex++}`);
		} else if (event.action === "invite.revoked") {
			push("revoked", event.createdAt, `audit-${revokedIndex++}`);
		}
	}

	const kindOrder: Record<TimelineEvent["kind"], number> = {
		invited: 0,
		opened: 1,
		consented: 2,
		started: 3,
		submitted: 4,
		scored: 5,
		resent: 6,
		revoked: 7,
	};

	return events.sort((a, b) => {
		const delta = a.at.getTime() - b.at.getTime();
		if (delta !== 0) return delta;
		return kindOrder[a.kind] - kindOrder[b.kind];
	});
}

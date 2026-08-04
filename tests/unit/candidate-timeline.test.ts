import { describe, expect, it } from "vitest";
import { buildCandidateTimeline } from "@/lib/candidate-timeline";

const t = (iso: string) => new Date(iso);

describe("buildCandidateTimeline", () => {
	it("returns empty when nothing has happened", () => {
		expect(
			buildCandidateTimeline({
				sentAt: null,
				openedAt: null,
				consentedAt: null,
				startedAt: null,
				submittedAt: null,
				scoredAt: null,
			}),
		).toEqual([]);
	});

	it("emits invited when only sentAt is set", () => {
		const events = buildCandidateTimeline({
			sentAt: t("2026-08-01T10:00:00.000Z"),
			openedAt: null,
			consentedAt: null,
			startedAt: null,
			submittedAt: null,
			scoredAt: null,
		});
		expect(events).toHaveLength(1);
		expect(events[0]?.kind).toBe("invited");
		expect(events[0]?.label).toBe("Invitation sent");
	});

	it("orders the full happy path chronologically", () => {
		const events = buildCandidateTimeline({
			sentAt: t("2026-08-01T10:00:00.000Z"),
			openedAt: t("2026-08-01T11:00:00.000Z"),
			consentedAt: t("2026-08-01T11:05:00.000Z"),
			startedAt: t("2026-08-01T11:05:00.000Z"),
			submittedAt: t("2026-08-01T12:00:00.000Z"),
			scoredAt: t("2026-08-01T12:00:01.000Z"),
		});
		expect(events.map((e) => e.kind)).toEqual([
			"invited",
			"opened",
			"consented",
			"started",
			"submitted",
			"scored",
		]);
	});

	it("includes resent and revoked from audit without exposing tokens", () => {
		const events = buildCandidateTimeline(
			{
				sentAt: t("2026-08-01T10:00:00.000Z"),
				openedAt: null,
				consentedAt: null,
				startedAt: null,
				submittedAt: null,
				scoredAt: null,
			},
			[
				{ action: "invite.resent", createdAt: t("2026-08-02T09:00:00.000Z") },
				{ action: "invite.revoked", createdAt: t("2026-08-03T09:00:00.000Z") },
				{ action: "result.viewed", createdAt: t("2026-08-04T09:00:00.000Z") },
			],
		);
		expect(events.map((e) => e.kind)).toEqual(["invited", "resent", "revoked"]);
		for (const event of events) {
			expect(JSON.stringify(event)).not.toMatch(/[A-Za-z0-9_-]{40,}/);
		}
	});
});

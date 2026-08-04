import { describe, expect, it } from "vitest";
import {
	type AuditDisplayRow,
	auditActionLabel,
	endOfLocalDay,
	filterAuditRows,
	formatAuditMeta,
	startOfLocalDay,
} from "@/lib/audit-display";

function row(
	partial: Partial<AuditDisplayRow> &
		Pick<AuditDisplayRow, "id" | "action" | "createdAt">,
): AuditDisplayRow {
	return {
		actorId: "u1",
		actorName: "Ada",
		subjectId: null,
		subjectExists: false,
		subjectLabel: null,
		meta: null,
		...partial,
	};
}

describe("audit-display", () => {
	it("maps known actions to plain labels", () => {
		expect(auditActionLabel("data.purged")).toBe("Candidate data purged");
		expect(auditActionLabel("unknown.action")).toBe("unknown.action");
	});

	it("filters by action and inclusive date range", () => {
		const mid = new Date("2026-08-05T12:00:00");
		const rows = [
			row({
				id: "1",
				action: "invite.created",
				createdAt: new Date("2026-08-04T10:00:00"),
			}),
			row({ id: "2", action: "invite.created", createdAt: mid }),
			row({ id: "3", action: "data.purged", createdAt: mid }),
		];

		expect(
			filterAuditRows(rows, {
				action: "invite.created",
				from: startOfLocalDay(mid),
				to: endOfLocalDay(mid),
			}).map((r) => r.id),
		).toEqual(["2"]);
	});

	it("formats meta without banned keys", () => {
		expect(
			formatAuditMeta({
				count: 3,
				email: "leak@example.com",
				nested: { a: 1 },
			}),
		).toEqual([
			{ key: "count", value: "3" },
			{ key: "nested", value: '{"a":1}' },
		]);
	});
});

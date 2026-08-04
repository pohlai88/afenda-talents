import { describe, expect, it } from "vitest";
import {
	classifyInviteRows,
	inviteRowCounts,
	parseInviteLines,
	validInviteEntries,
} from "@/lib/invite-parse";

describe("parseInviteLines", () => {
	it("parses name, email lines and skips blanks", () => {
		const rows = parseInviteLines(
			"Amira Yusof, amira@example.com\n\nDaniel Tan, daniel@example.com\n",
		);
		expect(rows).toHaveLength(2);
		expect(rows[0]?.fullName).toBe("Amira Yusof");
		expect(rows[0]?.email).toBe("amira@example.com");
		expect(rows[0]?.line).toBe(1);
	});

	it("keeps malformed lines for review", () => {
		const rows = parseInviteLines("Only a name");
		expect(rows).toHaveLength(1);
		expect(rows[0]?.fullName).toBe("Only a name");
		expect(rows[0]?.email).toBe("");
	});
});

describe("classifyInviteRows", () => {
	it("marks invalid, existing, duplicate, and valid", () => {
		const parsed = parseInviteLines(
			[
				"Amira Yusof, amira@example.com",
				"Existing Person, taken@example.com",
				"Dup One, amira@example.com",
				"Bad Line",
				"Good Two, good@example.com",
			].join("\n"),
		);
		const rows = classifyInviteRows(parsed, ["taken@example.com"]);
		expect(rows.map((r) => r.status)).toEqual([
			"valid",
			"existing",
			"duplicate",
			"invalid",
			"valid",
		]);
		expect(inviteRowCounts(rows)).toEqual({
			valid: 2,
			invalid: 1,
			duplicate: 1,
			existing: 1,
		});
		expect(validInviteEntries(rows)).toEqual([
			{ fullName: "Amira Yusof", email: "amira@example.com" },
			{ fullName: "Good Two", email: "good@example.com" },
		]);
	});

	it("normalises email case for existing and duplicates", () => {
		const parsed = parseInviteLines("A, a@Example.com\nB, A@example.com");
		const rows = classifyInviteRows(parsed, ["A@EXAMPLE.COM"]);
		expect(rows[0]?.status).toBe("existing");
		expect(rows[1]?.status).toBe("existing");
	});
});

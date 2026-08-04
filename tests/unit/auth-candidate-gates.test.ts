import { describe, expect, it } from "vitest";
import { allowsAnswerWrites } from "@/lib/assignment-gates";

describe("allowsAnswerWrites", () => {
	it("rejects SENT — answers must not land before consent", () => {
		expect(allowsAnswerWrites("SENT")).toBe(false);
	});

	it("allows STARTED after consent", () => {
		expect(allowsAnswerWrites("STARTED")).toBe(true);
	});

	it("rejects closed statuses", () => {
		expect(allowsAnswerWrites("SUBMITTED")).toBe(false);
		expect(allowsAnswerWrites("SCORED")).toBe(false);
		expect(allowsAnswerWrites("REVOKED")).toBe(false);
	});
});

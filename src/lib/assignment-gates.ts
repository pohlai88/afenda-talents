/**
 * Pure status gates for candidate APIs — no Prisma (testable at the boundary).
 * Consent must precede answers (spec §13.7).
 */
export function allowsAnswerWrites(status: string): boolean {
	return status === "STARTED";
}

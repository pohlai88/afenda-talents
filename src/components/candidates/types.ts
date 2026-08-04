/**
 * Shared candidate list row shape for cards and the datatable.
 *
 * One row per CandidateAssignment (D18) — the same person may hold more than one
 * assignment across hiring rounds. `id` is the candidate id (profile link target);
 * `assignmentId` is the invite/completion unit that resend/revoke act on.
 */
export type CandidateListItem = {
	id: string;
	assignmentId: string;
	fullName: string;
	email: string;
	status: string;
	sentAt: Date | null;
	submittedAt: Date | null;
	lastActivityAt: Date | null;
	invitedByName: string | null;
};

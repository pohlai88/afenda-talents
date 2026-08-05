/**
 * Subjects shared by the live sender and the admin preview.
 * Kept out of `lib/email.ts` so client components can import them without
 * pulling Resend / env into the browser bundle.
 */
export const INVITATION_SUBJECT = "Your Afenda Talents self-assessment";
export const RECEIPT_SUBJECT =
	"We have received your Afenda Talents self-assessment";

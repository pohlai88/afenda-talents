/**
 * Audit actions rendered as sentences.
 *
 * Audit rows store identifiers only (build-skill invariant 6). Names are resolved by
 * the caller from the live User and Candidate tables and passed in — nothing here
 * reads or writes an identity, and a purged candidate degrades to a phrase rather
 * than a dangling id.
 *
 * Sign-ins, password changes and purges are deliberately absent: the first two are
 * noise on a hiring feed, and purge belongs on the data page.
 */
export const FEED_ACTIONS = [
  "invite.created",
  "invite.resent",
  "invite.revoked",
  "candidate.consented",
  "assessment.submitted",
  "result.viewed",
  "export.downloaded",
] as const;

const UNKNOWN_ACTOR = "Someone";
const DELETED_SUBJECT = "a candidate whose record was deleted";

export function activitySentence({
  action,
  actorName,
  subjectName,
}: {
  action: string;
  actorName: string | null;
  subjectName: string | null;
}): string | null {
  const who = actorName ?? UNKNOWN_ACTOR;
  const whom = subjectName ?? DELETED_SUBJECT;

  switch (action) {
    case "invite.created":
      return `${who} invited ${whom}`;
    case "invite.resent":
      return `${who} resent the invitation to ${whom}`;
    case "invite.revoked":
      return `${who} revoked the invitation for ${whom}`;
    case "candidate.consented":
      return `${whom} gave consent`;
    case "assessment.submitted":
      return `${whom} submitted their assessment`;
    case "result.viewed":
      return `${who} reviewed the profile for ${whom}`;
    case "export.downloaded":
      return `${who} exported the results`;
    default:
      return null;
  }
}

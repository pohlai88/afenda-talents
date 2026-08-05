import type { Status } from "@/lib/status-constants";

/**
 * Canonical status codes are for the database, the CSV export, and audit rows.
 * They are not for hiring managers. This module is the single place a code becomes
 * a sentence — see the requirements document §18.2 and DECISIONS.md D17.
 *
 * Pure: no Prisma, no I/O, no React. Unit-tested in tests/unit/status-display.test.ts.
 */
export type StatusTone = "neutral" | "info" | "progress" | "ready" | "exception";

export type StatusDisplay = { label: string; tone: StatusTone };

const DISPLAY: Record<Status, StatusDisplay> = {
  DRAFT: { label: "Invitation prepared", tone: "neutral" },
  SENT: { label: "Invitation sent", tone: "info" },
  STARTED: { label: "Assessment started", tone: "progress" },
  // Deliberately not "Completed". Scoring is synchronous today, but SUBMITTED is a
  // real intermediate state, and "Completed" would promise a profile that may not exist.
  SUBMITTED: { label: "Processing results", tone: "progress" },
  SCORED: { label: "Ready for review", tone: "ready" },
  // An expired or revoked invitation is an administrative fact, not an error, so the
  // exception tone is a muted outline — never destructive red.
  EXPIRED: { label: "Invitation expired", tone: "exception" },
  REVOKED: { label: "Invitation revoked", tone: "exception" },
};

export function statusDisplay(status: Status): StatusDisplay {
  return DISPLAY[status];
}

/**
 * The overview strip is a current-state distribution: each candidate is counted once,
 * under the stage matching their present status. It is not a conversion funnel — the
 * system stores no stage-transition history, so "ever reached stage" is unknowable.
 *
 * DRAFT is absent on purpose: the invite handler moves a candidate to SENT in the same
 * request, so a persisted DRAFT row is a failure, not a stage.
 */
export const WORKFLOW_STAGES = ["SENT", "STARTED", "SUBMITTED", "SCORED"] as const;

export const EXCEPTION_STAGES = ["EXPIRED", "REVOKED"] as const;

export const STAGE_EXPLANATION: Record<(typeof WORKFLOW_STAGES)[number], string> = {
  SENT: "Personal link sent, not opened yet",
  STARTED: "Opened the link and began answering",
  SUBMITTED: "Answers received, profile being prepared",
  SCORED: "Profile ready for a hiring reviewer",
};

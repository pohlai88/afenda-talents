import type { Status } from "@/lib/status-constants";

/**
 * Attention rules — product policy, written down.
 *
 * Pure by design: it imports no Prisma and performs no I/O, so every threshold is
 * testable at its boundary. The overview fetches rows and hands them here.
 *
 * Nothing here sends anything. "Resend invitation" stays an explicit administrator
 * action (build spec §12 forbids scheduled reminders, and DECISIONS.md D17 does not
 * relax that).
 */
export const UNOPENED_AFTER_HOURS = 72;
export const STALLED_AFTER_HOURS = 72;
export const EXPIRING_WITHIN_HOURS = 72;

export type AttentionKind = "expiring" | "unopened" | "stalled" | "awaiting-review";

export type CandidateFacts = {
  /** CandidateAssignment id — the invite/completion unit (D18). */
  id: string;
  fullName: string;
  status: Status;
  sentAt: Date | null;
  openedAt: Date | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  /** max(Response.updatedAt) for this assignment, or null when nothing is saved yet. */
  lastResponseAt: Date | null;
  /** Result.computedAt, or null when unscored. */
  computedAt: Date | null;
  /** Newest result.viewed audit event for this assignment, or null. */
  lastViewedAt: Date | null;
};

export type AttentionItem = {
  kind: AttentionKind;
  /** Assignment id for profile links. */
  assignmentId: string;
  fullName: string;
  reason: string;
  /** The moment the row's age is measured from. */
  since: Date;
};

export type WorkspaceAttentionItem = { userId: string; name: string; reason: string };

const HOUR = 3_600_000;

/** Time-critical first. Within a kind, the oldest — most overdue — leads. */
const KIND_ORDER: AttentionKind[] = ["expiring", "unopened", "stalled", "awaiting-review"];

export function hiringAttention(facts: CandidateFacts[], now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const c of facts) {
    if (
      c.status === "SENT" &&
      !c.openedAt &&
      c.sentAt &&
      now.getTime() - c.sentAt.getTime() > UNOPENED_AFTER_HOURS * HOUR
    ) {
      items.push({
        kind: "unopened",
        assignmentId: c.id,
        fullName: c.fullName,
        reason: "Invitation sent but never opened",
        since: c.sentAt,
      });
    }

    if (c.status === "STARTED") {
      // Staleness is measured from the last saved answer. startedAt alone would flag
      // anyone who opened the link days ago and is answering right now.
      const lastActivity = c.lastResponseAt ?? c.startedAt;
      if (lastActivity && now.getTime() - lastActivity.getTime() > STALLED_AFTER_HOURS * HOUR) {
        items.push({
          kind: "stalled",
          assignmentId: c.id,
          fullName: c.fullName,
          reason: "Started the assessment, nothing saved since",
          since: lastActivity,
        });
      }
    }

    if ((c.status === "SENT" || c.status === "STARTED") && c.expiresAt) {
      const remaining = c.expiresAt.getTime() - now.getTime();
      if (remaining > 0 && remaining < EXPIRING_WITHIN_HOURS * HOUR) {
        items.push({
          kind: "expiring",
          assignmentId: c.id,
          fullName: c.fullName,
          reason: "Invitation expires soon",
          since: c.expiresAt,
        });
      }
    }

    if (c.status === "SCORED" && c.computedAt) {
      const reviewed = c.lastViewedAt !== null && c.lastViewedAt.getTime() > c.computedAt.getTime();
      if (!reviewed) {
        items.push({
          kind: "awaiting-review",
          assignmentId: c.id,
          fullName: c.fullName,
          reason: "Profile ready, not opened by anyone yet",
          since: c.computedAt,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    return byKind !== 0 ? byKind : a.since.getTime() - b.since.getTime();
  });
}

export function workspaceAttention(
  users: { id: string; name: string; mustChangePassword: boolean }[],
): WorkspaceAttentionItem[] {
  return users
    .filter((u) => u.mustChangePassword)
    .map((u) => ({
      userId: u.id,
      name: u.name,
      reason: "Still signing in with a password an admin issued",
    }));
}

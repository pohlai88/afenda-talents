import { db } from "@/lib/db";

/**
 * The candidate status machine. This module is the ONLY writer of Candidate.status —
 * the transition table is what stops a submitted assessment being reopened or a revoked
 * link coming back to life. Spec §3; build-skill invariant 3.
 */
export const STATUSES = [
  "DRAFT",
  "SENT",
  "STARTED",
  "SUBMITTED",
  "SCORED",
  "EXPIRED",
  "REVOKED",
] as const;

export type Status = (typeof STATUSES)[number];

const LEGAL: Record<Status, readonly Status[]> = {
  DRAFT: ["SENT"],
  SENT: ["STARTED", "EXPIRED", "REVOKED"],
  STARTED: ["SUBMITTED", "EXPIRED", "REVOKED"],
  SUBMITTED: ["SCORED"],
  SCORED: [],
  EXPIRED: ["SENT"], // resend only — issues a fresh token
  REVOKED: ["SENT"], // resend only — issues a fresh token
};

export class IllegalStatusTransition extends Error {
  constructor(from: Status, to: Status) {
    super(`Illegal status transition: ${from} -> ${to}`);
    this.name = "IllegalStatusTransition";
  }
}

export function canTransition(from: Status, to: Status): boolean {
  return LEGAL[from]?.includes(to) ?? false;
}

export function assertTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) throw new IllegalStatusTransition(from, to);
}

/**
 * Applies a transition after checking it against the table.
 * `extra` carries the timestamp columns that accompany a transition,
 * e.g. { startedAt: new Date() } alongside STARTED.
 */
export async function applyStatus(
  candidateId: string,
  to: Status,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { status: true },
  });
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  assertTransition(candidate.status as Status, to);

  await db.candidate.update({
    where: { id: candidateId },
    data: { status: to, ...extra },
  });
}

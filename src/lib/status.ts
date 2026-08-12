import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  assertTransition,
  type Status,
  type StatusTransitionExtra,
} from "@/lib/status-constants";

export class AssignmentNotFound extends Error {
  constructor(id: string) {
    super(`Assignment not found: ${id}`);
    this.name = "AssignmentNotFound";
  }
}

export class ConcurrentStatusTransition extends Error {
  constructor(id: string) {
    super(`Assignment changed during status transition: ${id}`);
    this.name = "ConcurrentStatusTransition";
  }
}

/**
 * The single write boundary for CandidateAssignment.status.
 *
 * The transition is validated from the latest visible row and written with a
 * compare-and-set predicate. Callers may pass a Prisma transaction so the status,
 * result, and audit entry commit as one operation.
 */
export async function applyStatus(
  id: string,
  to: Status,
  extra: StatusTransitionExtra = {},
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  const current = await client.candidateAssignment.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) throw new AssignmentNotFound(id);
  assertTransition(current.status, to);

  const updated = await client.candidateAssignment.updateMany({
    where: { id, status: current.status },
    data: { status: to, ...extra },
  });
  if (updated.count !== 1) throw new ConcurrentStatusTransition(id);
}

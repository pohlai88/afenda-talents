import { db } from "@/lib/db";

export type OperationalRound = {
  id: string;
  name: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
  assessmentTitle: string;
  versionNumber: number;
};

const STATUS_ORDER: Record<OperationalRound["status"], number> = {
  OPEN: 0,
  DRAFT: 1,
  CLOSED: 2,
  ARCHIVED: 3,
};

/**
 * Resolve the round carried by the URL. When no round is supplied, prefer the most
 * recently updated OPEN round, then the most recently updated non-archived round, then
 * the latest historical round. This makes the existing multi-round domain explicit on
 * every operational surface without introducing another source of truth.
 */
export async function resolveOperationalRound(
  requestedRoundId?: string | null,
): Promise<{ selected: OperationalRound | null; rounds: OperationalRound[] }> {
  const rows = await db.hiringRound.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      assessmentVersion: {
        select: {
          versionNumber: true,
          assessment: { select: { title: true } },
        },
      },
    },
  });

  const rounds = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      assessmentTitle: row.assessmentVersion.assessment.title,
      versionNumber: row.assessmentVersion.versionNumber,
      updatedAt: row.updatedAt,
    }))
    .sort(
      (left, right) =>
        STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
        right.updatedAt.getTime() - left.updatedAt.getTime(),
    )
    .map(({ updatedAt: _updatedAt, ...round }) => round);

  const requested = requestedRoundId
    ? rounds.find((round) => round.id === requestedRoundId)
    : null;
  const selected =
    requested ??
    rounds.find((round) => round.status === "OPEN") ??
    rounds.find((round) => round.status !== "ARCHIVED") ??
    rounds[0] ??
    null;

  return { selected, rounds };
}

export function withRound(
  path: string,
  roundId: string | null | undefined,
): string {
  if (!roundId) return path;
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("round", roundId);
  return `${pathname}?${params.toString()}`;
}

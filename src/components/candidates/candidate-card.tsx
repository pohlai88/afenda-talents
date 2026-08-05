import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { CandidateRowActions } from "@/components/candidates/row-actions";
import { relativeTime } from "@/lib/relative-time";
import { Card, CardContent } from "@/components/ui/card";
import type { CandidateListItem } from "@/components/candidates/types";

/**
 * The mobile equivalent of a row (requirements §7.5, §17.1). A horizontally scrolling
 * eight-column table on a phone is not a table anyone can read, so below `md` the
 * registry renders these instead — same information, stacked, actions still labelled.
 */
export function CandidateCard({
  item,
  isAdmin,
  now,
}: {
  item: CandidateListItem;
  isAdmin: boolean;
  now: Date;
}) {
  return (
    <li>
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/candidate/${item.assignmentId}`}
            className="block truncate font-medium underline-offset-4 hover:underline"
          >
            {item.fullName}
          </Link>
          <p className="truncate text-sm text-muted-foreground">{item.email}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Invited</dt>
          <dd className="tabular-nums">{item.sentAt?.toLocaleDateString("en-GB") ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Submitted</dt>
          <dd className="tabular-nums">{item.submittedAt?.toLocaleDateString("en-GB") ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Last activity</dt>
          <dd>{item.lastActivityAt ? relativeTime(item.lastActivityAt, now) : "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Invited by</dt>
          <dd className="truncate">{item.invitedByName ?? "—"}</dd>
        </div>
      </dl>

      {isAdmin && (
        <CandidateRowActions
          candidateId={item.id}
          assignmentId={item.assignmentId}
          fullName={item.fullName}
          status={item.status}
        />
      )}
      </CardContent>
    </Card>
    </li>
  );
}

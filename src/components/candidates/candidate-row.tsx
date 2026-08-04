"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { CandidateRowActions } from "@/components/candidates/row-actions";
import { relativeTime } from "@/components/overview/round-summary";

export type CandidateListItem = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  sentAt: Date | null;
  submittedAt: Date | null;
  lastActivityAt: Date | null;
  invitedByName: string | null;
};

export function CandidateRow({
  item,
  isAdmin,
  now,
}: {
  item: CandidateListItem;
  isAdmin: boolean;
  now: Date;
}) {
  const router = useRouter();

  return (
    <TableRow
      data-candidate-id={item.id}
      className="cursor-pointer"
      onClick={(event) => {
        // Row-click is a convenience layered on top of a real link (§7.5). Clicks that
        // start inside a button, link, or menu belong to that control, not to the row.
        if ((event.target as HTMLElement).closest("a,button,[role='menu'],[role='dialog']")) return;
        router.push(`/admin/candidate/${item.id}`);
      }}
    >
      <TableCell className="font-medium">
        {/* The accessible primary: keyboard-reachable, middle-clickable, copyable. */}
        <Link href={`/admin/candidate/${item.id}`} className="underline-offset-4 hover:underline">
          {item.fullName}
        </Link>
      </TableCell>
      <TableCell className="max-w-56 truncate text-muted-foreground" title={item.email}>
        {item.email}
      </TableCell>
      <TableCell>
        <StatusBadge status={item.status} />
      </TableCell>
      <TableCell className="tabular-nums">
        {item.sentAt?.toLocaleDateString("en-GB") ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {item.lastActivityAt ? relativeTime(item.lastActivityAt, now) : "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {item.submittedAt?.toLocaleDateString("en-GB") ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">{item.invitedByName ?? "—"}</TableCell>
      <TableCell className="text-right">
        {isAdmin && (
          <CandidateRowActions id={item.id} fullName={item.fullName} status={item.status} />
        )}
      </TableCell>
    </TableRow>
  );
}

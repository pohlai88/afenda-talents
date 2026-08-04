import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

/**
 * Durations, not clock times. The server runs UTC while the hiring team is UTC+8, so
 * a rendered wall-clock time — or a "Good morning" — would frequently be wrong. A
 * difference between two instants is timezone-independent, so it is safe on the server.
 */
export function relativeTime(from: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function untilTime(target: Date, now: Date): string {
  const hours = Math.max(0, Math.round((target.getTime() - now.getTime()) / 3_600_000));
  if (hours < 1) return "in under an hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function RoundSummary({
  firstName,
  total,
  ready,
  needsAttention,
  lastActivityAt,
  now,
  isAdmin,
}: {
  firstName: string;
  total: number;
  ready: number;
  needsAttention: number;
  lastActivityAt: Date | null;
  now: Date;
  isAdmin: boolean;
}) {
  const sentence = [
    `${total} candidate${total === 1 ? "" : "s"} in this hiring round`,
    ready > 0 ? `${ready} ready for review` : null,
    needsAttention > 0 ? `${needsAttention} needing follow-up` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PageHeader
      eyebrow="Hiring overview"
      title={`Welcome back, ${firstName}`}
      description={`${sentence}.`}
      meta={
        lastActivityAt && (
          <span className="text-muted-foreground">
            Last activity {relativeTime(lastActivityAt, now)}
          </span>
        )
      }
      actions={
        <>
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
            View all candidates
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" nativeButton={false} render={<a href="/api/admin/export" />}>
                Export results
              </Button>
              <Button nativeButton={false} render={<Link href="/admin/invite" />}>
                Invite candidates
              </Button>
            </>
          )}
        </>
      }
    />
  );
}

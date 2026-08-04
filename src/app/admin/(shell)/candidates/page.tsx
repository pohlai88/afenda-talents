import Link from "next/link";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { statusDisplay } from "@/lib/status-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CandidateRowActions } from "@/components/candidate-row-actions";

export const dynamic = "force-dynamic";

/**
 * The operational registry. Priority 1 ships it thin: the overview's workflow strip
 * links here with ?status=, and that is the only filtering. Search, sorting, saved
 * views and responsive cards are Priority 2.
 */
export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const { status } = await searchParams;

  const candidates = await db.candidate.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "asc" },
  });

  const filterLabel = status ? statusDisplay(status).label : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="This hiring round"
        title="Candidates"
        description="Find a candidate, check where they are, and act on their invitation."
        meta={
          filterLabel ? (
            <>
              <span className="text-muted-foreground">
                Showing {candidates.length} with status “{filterLabel}”
              </span>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/admin/candidates" />}
              >
                Clear filter
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {candidates.length} in this round
            </span>
          )
        }
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" nativeButton={false} render={<a href="/api/admin/export" />}>
                Export CSV
              </Button>
              <Button nativeButton={false} render={<Link href="/admin/invite" />}>
                Invite candidates
              </Button>
            </>
          ) : null
        }
      />

      <Card>
        <CardContent>
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm font-medium">
                {filterLabel ? "No candidates at this stage" : "No candidates invited yet"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {filterLabel
                  ? "Nobody in this round currently has that status."
                  : "Invite candidates by email. Each receives a personal one-time link."}
              </p>
              {filterLabel ? (
                <Button
                  className="mt-2"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/admin/candidates" />}
                >
                  Show all candidates
                </Button>
              ) : (
                isAdmin && (
                  <Button
                    className="mt-2"
                    nativeButton={false}
                    render={<Link href="/admin/invite" />}
                  >
                    Invite candidates
                  </Button>
                )
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id} data-candidate-id={c.id}>
                    <TableCell className="font-medium">
                      {c.status === "SCORED" ? (
                        <Link
                          className="underline underline-offset-4"
                          href={`/admin/candidate/${c.id}`}
                        >
                          {c.fullName}
                        </Link>
                      ) : (
                        c.fullName
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground" title={c.email}>
                      {c.email}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.sentAt?.toLocaleDateString("en-GB") ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.submittedAt?.toLocaleDateString("en-GB") ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && <CandidateRowActions id={c.id} status={c.status} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

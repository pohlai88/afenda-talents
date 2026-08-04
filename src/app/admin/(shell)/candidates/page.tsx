import Link from "next/link";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import {
  PAGE_SIZE,
  parseCandidateQuery,
  queryToWhere,
  type CandidateQuery,
} from "@/lib/candidate-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/candidates/filter-bar";
import { CandidateRow, type CandidateListItem } from "@/components/candidates/candidate-row";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { NoCandidates, NoFilterMatch, NoSearchMatch } from "@/components/candidates/empty-states";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "Candidate",
  "Contact",
  "Progress",
  "Invited",
  "Last activity",
  "Submitted",
  "Invited by",
];

/**
 * Sorting happens in memory: "last activity" is derived rather than stored, so Prisma
 * cannot order by it, and one hiring round is bounded by the 200-per-request invite cap.
 * Note what is absent — there is no sort by score or band. That would be a ranking.
 */
function sortItems(items: CandidateListItem[], query: CandidateQuery): CandidateListItem[] {
  const factor = query.direction === "asc" ? 1 : -1;
  const time = (d: Date | null) => d?.getTime() ?? 0;
  return [...items].sort((a, b) => {
    switch (query.sort) {
      case "name":
        return factor * a.fullName.localeCompare(b.fullName);
      case "submitted":
        return factor * (time(a.submittedAt) - time(b.submittedAt));
      case "activity":
        return factor * (time(a.lastActivityAt) - time(b.lastActivityAt));
      default:
        return factor * (time(a.sentAt) - time(b.sentAt));
    }
  });
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const now = new Date();

  const query = parseCandidateQuery(await searchParams);

  const [matching, totalInRound, responseActivity, users] = await Promise.all([
    db.candidate.findMany({ where: queryToWhere(query), orderBy: { createdAt: "asc" } }),
    db.candidate.count(),
    db.response.groupBy({ by: ["candidateId"], _max: { updatedAt: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  const lastResponseAt = new Map(responseActivity.map((r) => [r.candidateId, r._max.updatedAt]));
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const items: CandidateListItem[] = matching.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    status: c.status,
    sentAt: c.sentAt,
    submittedAt: c.submittedAt,
    // The most recent thing that happened, whichever it was.
    lastActivityAt:
      [lastResponseAt.get(c.id) ?? null, c.submittedAt, c.openedAt, c.sentAt]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    invitedByName: c.invitedById ? (userNames.get(c.invitedById) ?? null) : null,
  }));

  const sorted = sortItems(items, query);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (query.search) next.set("q", query.search);
    if (query.status) next.set("status", query.status);
    if (query.shortcut) next.set("view", query.shortcut);
    if (query.sort !== "invited") next.set("sort", query.sort);
    if (query.direction !== "desc") next.set("dir", query.direction);
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/admin/candidates?${qs}` : "/admin/candidates";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="This hiring round"
        title="Candidates"
        description="Find a candidate, check where they are, and act on their invitation."
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

      <FilterBar query={query} resultCount={sorted.length} />

      <Card>
        <CardContent>
          {totalInRound === 0 ? (
            <NoCandidates isAdmin={isAdmin} />
          ) : sorted.length === 0 ? (
            query.search ? (
              <NoSearchMatch term={query.search} />
            ) : (
              <NoFilterMatch />
            )
          ) : (
            <>
              {/* Table on md and up; cards below, because eight columns do not fit a phone. */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      {COLUMNS.map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((item) => (
                      <CandidateRow key={item.id} item={item} isAdmin={isAdmin} now={now} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="flex flex-col gap-3 md:hidden">
                {visible.map((item) => (
                  <CandidateCard key={item.id} item={item} isAdmin={isAdmin} now={now} />
                ))}
              </ul>

              {pageCount > 1 && (
                <nav
                  aria-label="Candidate pages"
                  className="mt-4 flex items-center justify-between gap-2"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    nativeButton={false}
                    render={<Link href={pageHref(page - 1)} />}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= pageCount}
                    nativeButton={false}
                    render={<Link href={pageHref(page + 1)} />}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

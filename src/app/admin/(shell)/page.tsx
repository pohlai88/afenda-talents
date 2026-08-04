import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireHiringUser } from "@/lib/auth-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CandidateRowActions } from "@/components/candidate-row-actions";
import { DangerZone } from "@/components/danger-zone";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["SENT", "STARTED", "SUBMITTED", "SCORED", "EXPIRED", "REVOKED"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SENT: "secondary",
  STARTED: "outline",
  SUBMITTED: "default",
  SCORED: "default",
  EXPIRED: "destructive",
  REVOKED: "destructive",
};

export default async function AdminDashboardPage() {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";

  const candidates = await db.candidate.findMany({ orderBy: { createdAt: "asc" } });
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, candidates.filter((c) => c.status === s).length]),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          {candidates.length} invited this round
          {!isAdmin && " · read-only view"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUS_ORDER.map((status) => (
          <Card key={status} className="gap-1 py-3">
            <CardHeader className="px-4">
              <CardDescription className="text-xs">{status}</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <span className="text-2xl font-semibold tabular-nums">{counts[status]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This round</CardTitle>
          <CardDescription>
            Scored candidates link to their profile. Results are one input into a hiring
            decision — never a ranking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm font-medium">No candidates invited yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Invite candidates by email. Each receives a personal one-time link; once they
                consent, answer the 34 statements and submit, their profile appears here.
              </p>
              {isAdmin && (
                <Button className="mt-2" nativeButton={false} render={<Link href="/admin/invite" />}>
                  Invite candidates
                </Button>
              )}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
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
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
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

      {isAdmin && <DangerZone retentionDays={env.RETENTION_DAYS} />}
    </div>
  );
}

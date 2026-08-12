import Link from "next/link";
import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly } from "@/lib/corporate-admin/domain";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function customObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function customValue(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }

export default async function ObligationsPage() {
  const session = await requireWorkspaceUser();
  const [obligations, listFields] = await Promise.all([
    db.administrativeObligation.findMany({
      orderBy: [{ status: "asc" }, { nextDueDate: "asc" }, { createdAt: "desc" }],
      include: { counterparty: { select: { name: true } }, owner: { select: { name: true } }, dueItems: { where: { status: "OPEN" }, orderBy: { dueDate: "asc" }, take: 1 } },
    }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "OBLIGATION", isActive: true, showInList: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], take: 4 }),
  ]);
  const today = todayDateOnly();
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Corporate Administration"
        title="Obligations"
        description="One register for tenancy, subscriptions, insurance, fleet, maintenance, licences and other administrative commitments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AfendaPageHelp title="Obligations register" guidance={CORPORATE_PAGE_GUIDANCE.obligations} />
            {session.role === "ADMIN" ? <Button nativeButton={false} render={<Link href="/admin/corporate/obligations/new" />}>New obligation</Button> : null}
          </div>
        }
      />
      <CorporateNav />
      <Card>
        <CardHeader><CardTitle>Register</CardTitle><CardDescription>Open a record for its terms, due schedule and payment history.</CardDescription></CardHeader>
        <CardContent>
          {obligations.length === 0 ? (
            <Empty className="border border-dashed"><EmptyHeader><EmptyTitle>No obligations yet</EmptyTitle><EmptyDescription>Add your first recurring or one-off administrative commitment.</EmptyDescription></EmptyHeader>{session.role === "ADMIN" ? <EmptyContent><Button size="sm" nativeButton={false} render={<Link href="/admin/corporate/obligations/new" />}>Create obligation</Button></EmptyContent> : null}</Empty>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Obligation</TableHead><TableHead>Status</TableHead><TableHead>Next attention</TableHead><TableHead>Expected</TableHead><TableHead>Owner</TableHead>{listFields.map((field) => <TableHead key={field.id}>{field.label}</TableHead>)}</TableRow></TableHeader><TableBody>
                {obligations.map((row) => { const openDue = row.dueItems[0]; const date = openDue ? formatDateOnly(openDue.dueDate) : row.nextDueDate ? formatDateOnly(row.nextDueDate) : null; const dueState = date ? deriveDueState("OPEN", date, today) : null; const extras = customObject(row.customFields); return <TableRow key={row.id}><TableCell><Link className="font-mono text-xs underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}`}>{row.code}</Link></TableCell><TableCell><Link className="font-medium underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}`}>{row.title}</Link><p className="text-xs text-muted-foreground">{row.organization} · {row.counterparty.name}</p></TableCell><TableCell><CorporateStatusBadge status={row.status} /></TableCell><TableCell>{date ? <div className="space-y-1"><p className="text-sm tabular-nums">{date}</p>{dueState ? <CorporateStatusBadge status={dueState} /> : null}</div> : "—"}</TableCell><TableCell className="tabular-nums">{formatMoney(row.currency, row.expectedAmount == null ? null : Number(row.expectedAmount))}</TableCell><TableCell>{row.owner?.name ?? "—"}</TableCell>{listFields.map((field) => <TableCell key={field.id}>{customValue(extras[field.key])}</TableCell>)}</TableRow>; })}
              </TableBody></Table></div>
              <ul className="flex flex-col gap-3 lg:hidden">{obligations.map((row) => { const openDue = row.dueItems[0]; const date = openDue ? formatDateOnly(openDue.dueDate) : row.nextDueDate ? formatDateOnly(row.nextDueDate) : null; const state = date ? deriveDueState("OPEN", date, today) : null; return <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><Link className="font-medium underline-offset-4 hover:underline" href={`/admin/corporate/obligations/${row.id}`}>{row.title}</Link><p className="font-mono text-xs text-muted-foreground">{row.code}</p></div><CorporateStatusBadge status={row.status} /></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Counterparty</p><p>{row.counterparty.name}</p></div><div><p className="text-xs text-muted-foreground">Expected</p><p>{formatMoney(row.currency, row.expectedAmount == null ? null : Number(row.expectedAmount))}</p></div><div><p className="text-xs text-muted-foreground">Next attention</p><p>{date ?? "—"}</p></div><div>{state ? <CorporateStatusBadge status={state} /> : null}</div></div></li>; })}</ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

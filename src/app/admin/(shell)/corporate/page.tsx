import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly, parseDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorporateOverviewPage() {
  const session = await requireWorkspaceUser();
  const today = todayDateOnly();
  const todayDate = parseDateOnly(today);
  const thirty = new Date(todayDate); thirty.setUTCDate(thirty.getUTCDate() + 30);
  const [activeObligations, dueNext30, overdue, pendingApproval, unreconciled, attention] = await Promise.all([
    db.administrativeObligation.count({ where: { status: "ACTIVE" } }),
    db.obligationDueItem.count({ where: { status: "OPEN", dueDate: { gte: todayDate, lte: thirty } } }),
    db.obligationDueItem.count({ where: { status: "OPEN", dueDate: { lt: todayDate } } }),
    db.administrativePayment.count({ where: { approvalStatus: "PENDING" } }),
    db.administrativePayment.count({ where: { paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] }, reconciledAt: null } }),
    db.obligationDueItem.findMany({ where: { status: "OPEN" }, orderBy: { dueDate: "asc" }, take: 8, include: { obligation: { include: { counterparty: { select: { name: true } } } } } }),
  ]);
  const metrics = [
    ["Active obligations", activeObligations, "/admin/corporate/obligations"],
    ["Due next 30 days", dueNext30, "/admin/corporate/obligations"],
    ["Overdue", overdue, "/admin/corporate/obligations"],
    ["Pending approval", pendingApproval, "/admin/corporate/payments"],
    ["Awaiting reconciliation", unreconciled, "/admin/corporate/payments"],
  ] as const;
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader eyebrow="Corporate Administration" title="Administration control centre" description="See what is due, overdue, waiting for approval or still unreconciled—without maintaining status spreadsheets." actions={session.role === "ADMIN" ? <Button nativeButton={false} render={<Link href="/admin/corporate/obligations/new" />}>New obligation</Button> : undefined} />
      <CorporateNav />
      <section aria-label="Corporate administration metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, href]) => <Link key={label} href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></Link>)}
      </section>
      <Card>
        <CardHeader><CardTitle>Due attention</CardTitle><CardDescription>Open due items are ordered by date. Time-sensitive states are derived at read time, so they cannot go stale overnight.</CardDescription></CardHeader>
        <CardContent>
          {attention.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No open due items.</p> : <ul className="divide-y">{attention.map((item) => { const date = formatDateOnly(item.dueDate); const state = deriveDueState(item.status, date, today); return <li key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><Link href={`/admin/corporate/obligations/${item.obligationId}`} className="font-medium underline-offset-4 hover:underline">{item.obligation.title}</Link><p className="text-sm text-muted-foreground">{item.periodLabel} · {item.obligation.counterparty.name} · due {date}</p></div><div className="flex items-center gap-3"><span className="text-sm font-medium tabular-nums">{formatMoney(item.currency, item.invoiceAmount == null ? item.expectedAmount == null ? null : Number(item.expectedAmount) : Number(item.invoiceAmount))}</span><CorporateStatusBadge status={state} /></div></li>; })}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}

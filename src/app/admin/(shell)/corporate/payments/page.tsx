import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CorporateStatusBadge, formatMoney } from "@/components/corporate/status";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireWorkspaceUser();
  const payments = await db.administrativePayment.findMany({
    orderBy: { requestDate: "desc" },
    take: 250,
    include: {
      dueItem: { include: { obligation: { include: { counterparty: { select: { name: true } } } } } },
      requestedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, reconciledBy: { select: { name: true } },
    },
  });
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader eyebrow="Corporate Administration" title="Payments" description="Operational queue for requested, approved, recorded and reconciled administrative payments." />
      <CorporateNav />
      <Card>
        <CardHeader><CardTitle>Payment register</CardTitle><CardDescription>Use the obligation record to approve, record evidence, reconcile or void a payment.</CardDescription></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No administrative payment requests yet.</p> : (
            <>
              <div className="hidden overflow-x-auto lg:block"><Table><TableHeader><TableRow><TableHead>Requested</TableHead><TableHead>Obligation / period</TableHead><TableHead>Requested amount</TableHead><TableHead>Approval</TableHead><TableHead>Payment</TableHead><TableHead>Reconciliation</TableHead><TableHead>Actor</TableHead></TableRow></TableHeader><TableBody>
                {payments.map((payment) => <TableRow key={payment.id}><TableCell className="text-sm tabular-nums">{payment.requestDate.toISOString().slice(0, 10)}</TableCell><TableCell><Link href={`/admin/corporate/obligations/${payment.dueItem.obligationId}`} className="font-medium underline-offset-4 hover:underline">{payment.dueItem.obligation.title}</Link><p className="text-xs text-muted-foreground">{payment.dueItem.periodLabel} · {payment.dueItem.obligation.counterparty.name}</p></TableCell><TableCell className="font-medium tabular-nums">{formatMoney(payment.dueItem.currency, Number(payment.requestedAmount))}</TableCell><TableCell><CorporateStatusBadge status={payment.approvalStatus} /></TableCell><TableCell><CorporateStatusBadge status={payment.paymentStatus} /></TableCell><TableCell>{payment.reconciledAt ? <CorporateStatusBadge status="RECONCILED" /> : <span className="text-sm text-muted-foreground">Pending</span>}</TableCell><TableCell className="text-sm text-muted-foreground">{payment.reconciledBy?.name ?? payment.approvedBy?.name ?? payment.requestedBy?.name ?? "—"}</TableCell></TableRow>)}
              </TableBody></Table></div>
              <ul className="flex flex-col gap-3 lg:hidden">{payments.map((payment) => <li key={payment.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/admin/corporate/obligations/${payment.dueItem.obligationId}`} className="font-medium underline-offset-4 hover:underline">{payment.dueItem.obligation.title}</Link><p className="text-xs text-muted-foreground">{payment.dueItem.periodLabel} · {payment.requestDate.toISOString().slice(0, 10)}</p></div><p className="font-medium tabular-nums">{formatMoney(payment.dueItem.currency, Number(payment.requestedAmount))}</p></div><div className="mt-3 flex flex-wrap gap-2"><CorporateStatusBadge status={payment.approvalStatus} /><CorporateStatusBadge status={payment.paymentStatus} />{payment.reconciledAt ? <CorporateStatusBadge status="RECONCILED" /> : null}</div></li>)}</ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

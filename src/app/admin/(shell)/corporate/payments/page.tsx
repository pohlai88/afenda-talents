import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaSection } from "@/components/afenda/section";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { PaymentRegister, type PaymentRegisterRow } from "@/components/corporate/payment-register";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
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

  const rows: PaymentRegisterRow[] = payments.map((payment) => ({
    id: payment.id,
    requestDate: payment.requestDate.toISOString().slice(0, 10),
    obligationId: payment.dueItem.obligationId,
    obligationTitle: payment.dueItem.obligation.title,
    periodLabel: payment.dueItem.periodLabel,
    counterpartyName: payment.dueItem.obligation.counterparty.name,
    currency: payment.dueItem.currency,
    requestedAmount: Number(payment.requestedAmount),
    approvalStatus: payment.approvalStatus,
    paymentStatus: payment.paymentStatus,
    reconciled: payment.reconciledAt != null,
    actorName: payment.reconciledBy?.name ?? payment.approvedBy?.name ?? payment.requestedBy?.name ?? null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Corporate Administration"
        title="Payments"
        description="Operational queue for requested, approved, recorded and reconciled administrative payments."
        actions={<AfendaPageHelp title="Administrative payments" guidance={CORPORATE_PAGE_GUIDANCE.payments} />}
      />
      <CorporateNav />
      <AfendaSection title="Payment register" description="Search and filter the queue, then use the obligation record to approve, record evidence, reconcile or void a payment.">
        {rows.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No administrative payment requests yet.</p> : <PaymentRegister rows={rows} />}
      </AfendaSection>
    </div>
  );
}

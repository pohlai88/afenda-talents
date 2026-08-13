import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaEmptyState } from "@/components/afenda/page-state";
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
    <AfendaPageFrame>
      <PageHeader
        eyebrow="Corporate Administration"
        title="Payments"
        description="Operational queue for requested, approved, recorded and reconciled administrative payments."
        actions={<AfendaPageHelp title="Administrative payments" guidance={CORPORATE_PAGE_GUIDANCE.payments} />}
      />
      <CorporateNav />
      <AfendaSection title="Payment register" description="Search and filter the queue, then use the obligation record to approve, record evidence, reconcile or void a payment.">
        {rows.length === 0 ? (
          <AfendaEmptyState
            title="No payment requests yet"
            description="Payment requests will appear here after they are created against obligation due items."
          />
        ) : <PaymentRegister rows={rows} />}
      </AfendaSection>
    </AfendaPageFrame>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SettlementClosureWorkspace } from "@/components/corporate/settlement-closure-workspace";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { closureBlockers } from "@/lib/corporate-admin/settlement";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function date(value: Date | null): string | null { return value ? value.toISOString().slice(0, 10) : null; }

export default async function SettlementClosurePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspaceUser();
  const { id } = await params;

  const [obligation, closure, openDueItems, pendingApprovals, unreconciledPayments] = await Promise.all([
    db.administrativeObligation.findUnique({ where: { id }, select: { id: true, code: true, title: true, status: true, currency: true } }),
    db.administrativeClosure.findUnique({ where: { obligationId: id }, include: { items: { orderBy: { createdAt: "asc" } } } }),
    db.obligationDueItem.count({ where: { obligationId: id, status: "OPEN" } }),
    db.administrativePayment.count({ where: { dueItem: { obligationId: id }, approvalStatus: "PENDING" } }),
    db.administrativePayment.count({ where: { dueItem: { obligationId: id }, paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] }, reconciledAt: null } }),
  ]);
  if (!obligation) notFound();

  const unresolvedReconciliationItems = closure ? closure.items.filter((item) => item.status === "OPEN" || item.status === "DISPUTED").length : 0;
  const blockers = closureBlockers({
    effectiveDate: closure ? date(closure.effectiveDate) : null,
    openDueItems,
    pendingApprovals,
    unreconciledPayments,
    unresolvedReconciliationItems,
    alreadyClosed: closure?.status === "CLOSED",
  });

  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Settlement"
        title="Settlement & file closure"
        description={`${obligation.code} · ${obligation.title}. End the agreement, reconcile historical/final balances, then close the administrative file only when all controls are clear.`}
        actions={<Button variant="outline" nativeButton={false} render={<Link href={`/admin/corporate/obligations/${id}`} />}>Back to obligation</Button>}
      />
      <CorporateNav />
      <SettlementClosureWorkspace
        obligation={{ id: obligation.id, code: obligation.code, title: obligation.title, status: obligation.status, currency: obligation.currency }}
        closure={closure ? {
          id: closure.id,
          status: closure.status,
          terminationType: closure.terminationType,
          noticeDate: date(closure.noticeDate),
          effectiveDate: date(closure.effectiveDate),
          handoverDate: date(closure.handoverDate),
          terminationReason: closure.terminationReason,
          terminationDocumentUrl: closure.terminationDocumentUrl,
          notes: closure.notes,
          closedAt: closure.closedAt?.toISOString() ?? null,
        } : null}
        items={(closure?.items ?? []).map((item) => ({
          id: item.id,
          category: item.category,
          direction: item.direction,
          description: item.description,
          expectedAmount: item.expectedAmount == null ? null : Number(item.expectedAmount),
          actualAmount: item.actualAmount == null ? null : Number(item.actualAmount),
          currency: item.currency,
          status: item.status,
          evidenceUrl: item.evidenceUrl,
          notes: item.notes,
        }))}
        blockers={blockers}
        counts={{ openDueItems, pendingApprovals, unreconciledPayments, unresolvedReconciliationItems }}
        isAdmin={session.role === "ADMIN"}
      />
    </AfendaPageFrame>
  );
}

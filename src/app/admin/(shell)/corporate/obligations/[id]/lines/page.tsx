import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { ObligationLineManager, type ObligationLineRow } from "@/components/corporate/obligation-line-manager";
import { CorporateStatusBadge } from "@/components/corporate/status";
import { Button } from "@/components/ui/button";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ObligationLinesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspaceUser();
  const { id } = await params;
  const obligation = await db.administrativeObligation.findUnique({
    where: { id },
    include: {
      counterparty: { select: { name: true } },
      lines: { orderBy: [{ isActive: "desc" }, { code: "asc" }], include: { _count: { select: { dueItems: true } } } },
    },
  });
  if (!obligation) notFound();

  const lines: ObligationLineRow[] = obligation.lines.map((line) => ({
    id: line.id,
    code: line.code,
    name: line.name,
    lineType: line.lineType,
    expectedAmount: line.expectedAmount == null ? null : Number(line.expectedAmount),
    currency: line.currency,
    recurring: line.recurring,
    recurrenceInterval: line.recurrenceInterval,
    recurrenceUnit: line.recurrenceUnit,
    firstDueDate: line.firstDueDate ? formatDateOnly(line.firstDueDate) : null,
    nextDueDate: line.nextDueDate ? formatDateOnly(line.nextDueDate) : null,
    invoiceRequired: line.invoiceRequired,
    paymentTermsDays: line.paymentTermsDays,
    startDate: line.startDate ? formatDateOnly(line.startDate) : null,
    endDate: line.endDate ? formatDateOnly(line.endDate) : null,
    notes: line.notes,
    isActive: line.isActive,
    dueCount: line._count.dueItems,
  }));

  return (
    <AfendaPageFrame width="record">
      <AfendaRecordHeader
        context="Corporate Administration · Agreement lines"
        title={obligation.title}
        identity={`${obligation.code} · ${obligation.counterparty.name}`}
        status={<CorporateStatusBadge status={obligation.status} />}
        actions={<Button variant="outline" nativeButton={false} render={<Link href={`/admin/corporate/obligations/${id}`} />}>Back to obligation</Button>}
      />
      <CorporateNav />
      <ObligationLineManager obligationId={id} obligationStatus={obligation.status} lines={lines} isAdmin={session.role === "ADMIN"} />
    </AfendaPageFrame>
  );
}

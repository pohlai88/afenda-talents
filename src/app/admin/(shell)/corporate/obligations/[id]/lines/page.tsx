import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { ObligationLineManager, type ObligationLineRow } from "@/components/corporate/obligation-line-manager";
import { ObligationLineSummary, type ObligationLineSummaryRow } from "@/components/corporate/obligation-line-summary";
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
      lines: {
        orderBy: [{ isActive: "desc" }, { code: "asc" }],
        include: {
          _count: { select: { dueItems: true } },
          dueItems: {
            orderBy: { dueDate: "desc" },
            take: 4,
            select: { id: true, periodLabel: true, dueDate: true, status: true, expectedAmount: true, invoiceAmount: true, currency: true },
          },
        },
      },
    },
  });
  if (!obligation) notFound();

  // The nested include above is capped at 4 per line for the summary cards. Collision
  // detection in the add-due form needs every label for a date, so fetch them flat.
  const dueLabels = await db.obligationDueItem.findMany({
    where: { obligationId: id },
    select: { lineId: true, dueDate: true, periodLabel: true },
    orderBy: { dueDate: "desc" },
  });

  const summaries: ObligationLineSummaryRow[] = obligation.lines.map((line) => ({
    id: line.id,
    code: line.code,
    name: line.name,
    isActive: line.isActive,
    recurring: line.recurring,
    nextDueDate: line.nextDueDate ? formatDateOnly(line.nextDueDate) : null,
    dueCount: line._count.dueItems,
    recentDues: line.dueItems.map((due) => ({
      id: due.id,
      periodLabel: due.periodLabel,
      dueDate: formatDateOnly(due.dueDate),
      status: due.status,
      amount: due.invoiceAmount == null ? (due.expectedAmount == null ? null : Number(due.expectedAmount)) : Number(due.invoiceAmount),
      currency: due.currency,
    })),
  }));

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
    dueItems: dueLabels
      .filter((due) => due.lineId === line.id)
      .map((due) => ({ dueDate: formatDateOnly(due.dueDate), periodLabel: due.periodLabel })),
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
      <ObligationLineSummary lines={summaries} />
      <ObligationLineManager obligationId={id} obligationStatus={obligation.status} lines={lines} isAdmin={session.role === "ADMIN"} />
    </AfendaPageFrame>
  );
}

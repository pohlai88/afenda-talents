import Link from "next/link";

import { AfendaAttentionList } from "@/components/afenda/attention-list";
import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaMetricCard } from "@/components/afenda/metric-card";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaSection } from "@/components/afenda/section";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CorporateStatusBadge, formatMoney, todayDateOnly, corporateStatusLabel } from "@/components/corporate/status";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly, parseDateOnly } from "@/lib/corporate-admin/domain";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorporateOverviewPage() {
  const session = await requireWorkspaceUser();
  const today = todayDateOnly();
  const todayDate = parseDateOnly(today);
  const thirty = new Date(todayDate);
  thirty.setUTCDate(thirty.getUTCDate() + 30);

  const [activeSites, activeObligations, dueNext30, overdue, pendingApproval, unreconciled, attention, siteCoverageReview] = await Promise.all([
    db.administrativeSite.count({ where: { isActive: true } }),
    db.administrativeObligation.count({ where: { status: "ACTIVE" } }),
    db.obligationDueItem.count({ where: { status: "OPEN", dueDate: { gte: todayDate, lte: thirty } } }),
    db.obligationDueItem.count({ where: { status: "OPEN", dueDate: { lt: todayDate } } }),
    db.administrativePayment.count({ where: { approvalStatus: "PENDING" } }),
    db.administrativePayment.count({ where: { paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] }, reconciledAt: null } }),
    db.obligationDueItem.findMany({
      where: { status: "OPEN" },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { obligation: { include: { counterparty: { select: { name: true } } } } },
    }),
    db.administrativeSite.findMany({
      where: { isActive: true, serviceCoverage: { none: { isActive: true } } },
      orderBy: { name: "asc" },
      take: 8,
      select: { id: true, code: true, name: true, type: true, organization: true },
    }),
  ]);

  const metrics = [
    { label: "Active sites", value: activeSites, href: "/admin/corporate/sites", description: "Operating locations in scope" },
    { label: "Active obligations", value: activeObligations, href: "/admin/corporate/obligations", description: "Currently operational commitments" },
    { label: "Due next 30 days", value: dueNext30, href: "/admin/corporate/obligations", description: "Open items due soon" },
    { label: "Overdue", value: overdue, href: "/admin/corporate/obligations", description: "Open items past due" },
    { label: "Pending approval", value: pendingApproval, href: "/admin/corporate/payments", description: "Payment requests awaiting decision" },
    { label: "Awaiting reconciliation", value: unreconciled, href: "/admin/corporate/payments", description: "Recorded payments not yet checked" },
  ] as const;

  const attentionItems = attention.map((item) => {
    const date = formatDateOnly(item.dueDate);
    const state = deriveDueState(item.status, date, today);
    return {
      id: item.id,
      href: `/admin/corporate/obligations/${item.obligationId}`,
      title: item.obligation.title,
      description: `${item.periodLabel} · ${item.obligation.counterparty.name} · due ${date}`,
      meta: <span className="text-sm font-medium tabular-nums">{formatMoney(item.currency, item.invoiceAmount == null ? item.expectedAmount == null ? null : Number(item.expectedAmount) : Number(item.invoiceAmount))}</span>,
      status: <CorporateStatusBadge status={state} />,
    };
  });

  const relationshipReviewItems = siteCoverageReview.map((site) => ({
    id: site.id,
    href: `/admin/corporate/sites/${site.id}`,
    title: site.name,
    description: `${site.code} · ${site.organization || corporateStatusLabel(site.type)} · no active service-coverage relationships recorded`,
    status: <Badge variant="outline">Review coverage</Badge>,
  }));

  return (
    <AfendaPageFrame>
      <PageHeader
        eyebrow="Corporate Administration"
        title="Administration control centre"
        description="See due work and relationship gaps across sites, counterparties, obligations and payments—without maintaining cross-sheet status trackers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AfendaPageHelp title="Corporate Administration overview" guidance={CORPORATE_PAGE_GUIDANCE.overview} />
            {session.role === "ADMIN" ? <><Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate/sites" />}>Add site</Button><Button nativeButton={false} render={<Link href="/admin/corporate/obligations/new" />}>New obligation</Button></> : null}
          </div>
        }
      />
      <CorporateNav />

      <section aria-label="Corporate administration metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => <AfendaMetricCard key={metric.label} {...metric} />)}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <AfendaSection title="Due attention" description="Open due items are ordered by date. Time-sensitive states are derived at read time, so they cannot go stale overnight.">
          <AfendaAttentionList items={attentionItems} emptyTitle="No open due items" emptyDescription="There is nothing in the current due-attention queue." />
        </AfendaSection>

        <AfendaSection title="Relationship review" description="Potential operating-model gaps derived from relationships, not another manually maintained status field.">
          <AfendaAttentionList items={relationshipReviewItems} emptyTitle="No uncovered active sites" emptyDescription="Every active site currently has at least one active service-coverage relationship recorded." />
        </AfendaSection>
      </div>
    </AfendaPageFrame>
  );
}

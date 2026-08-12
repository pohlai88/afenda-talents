import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateCommandPalette } from "@/components/corporate/corporate-command-palette";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CorporateOperationsConsole, type OperationsAgendaItem, type OperationsGridRow, type OperationsMatrixRow } from "@/components/corporate/operations-console";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function attentionFor(date: string, today: string): OperationsAgendaItem["attention"] {
  if (date < today) return "OVERDUE";
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const source = new Date(`${today}T00:00:00Z`).getTime();
  return target - source <= 7 * 86_400_000 ? "DUE_SOON" : "UPCOMING";
}

export default async function CorporateOperationsPage() {
  await requireWorkspaceUser();
  const today = new Date().toISOString().slice(0, 10);

  const [openDues, scheduledLines, datedObligations, sites, lines] = await Promise.all([
    db.obligationDueItem.findMany({
      where: { status: "OPEN" },
      orderBy: { dueDate: "asc" },
      take: 120,
      select: {
        id: true,
        periodLabel: true,
        dueDate: true,
        invoiceNumber: true,
        obligation: { select: { id: true, code: true, title: true } },
        line: { select: { code: true, name: true } },
      },
    }),
    db.administrativeObligationLine.findMany({
      where: { isActive: true, recurring: true, nextDueDate: { not: null }, obligation: { status: "ACTIVE" } },
      orderBy: { nextDueDate: "asc" },
      take: 120,
      select: { id: true, code: true, name: true, nextDueDate: true, obligation: { select: { id: true, code: true, title: true } } },
    }),
    db.administrativeObligation.findMany({
      where: { status: "ACTIVE", OR: [{ renewalDate: { not: null } }, { endDate: { not: null } }] },
      select: { id: true, code: true, title: true, renewalDate: true, endDate: true, counterparty: { select: { name: true } } },
    }),
    db.administrativeSite.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        serviceCoverage: {
          where: { isActive: true },
          select: { serviceCategory: true, counterparty: { select: { id: true, name: true } } },
          orderBy: [{ serviceCategory: "asc" }, { counterparty: { name: "asc" } }],
        },
      },
    }),
    db.administrativeObligationLine.findMany({
      orderBy: [{ obligation: { status: "asc" } }, { obligation: { title: "asc" } }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        lineType: true,
        expectedAmount: true,
        currency: true,
        recurring: true,
        nextDueDate: true,
        isActive: true,
        obligation: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            counterparty: { select: { name: true } },
            sites: { select: { site: { select: { name: true } } } },
          },
        },
        dueItems: { select: { status: true, dueDate: true } },
      },
    }),
  ]);

  const agenda: OperationsAgendaItem[] = [
    ...openDues.map((due) => {
      const date = formatDateOnly(due.dueDate);
      return {
        id: `due:${due.id}`,
        date,
        kind: "DUE" as const,
        title: `${due.line.name} · ${due.periodLabel}`,
        subtitle: `${due.obligation.code} · ${due.obligation.title}${due.invoiceNumber ? ` · ${due.invoiceNumber}` : ""}`,
        href: `/admin/corporate/obligations/${due.obligation.id}`,
        attention: attentionFor(date, today),
      };
    }),
    ...scheduledLines.map((line) => {
      const date = formatDateOnly(line.nextDueDate!);
      return {
        id: `line:${line.id}`,
        date,
        kind: "LINE_DUE" as const,
        title: `${line.name} · next scheduled occurrence`,
        subtitle: `${line.obligation.code} · ${line.obligation.title} · ${line.code}`,
        href: `/admin/corporate/obligations/${line.obligation.id}/lines`,
        attention: attentionFor(date, today),
      };
    }),
    ...datedObligations.flatMap((obligation) => {
      const entries: OperationsAgendaItem[] = [];
      if (obligation.renewalDate) {
        const date = formatDateOnly(obligation.renewalDate);
        entries.push({ id: `renewal:${obligation.id}`, date, kind: "RENEWAL", title: `${obligation.title} · renewal`, subtitle: `${obligation.code} · ${obligation.counterparty.name}`, href: `/admin/corporate/obligations/${obligation.id}`, attention: attentionFor(date, today) });
      }
      if (obligation.endDate) {
        const date = formatDateOnly(obligation.endDate);
        entries.push({ id: `end:${obligation.id}`, date, kind: "END", title: `${obligation.title} · agreement end`, subtitle: `${obligation.code} · ${obligation.counterparty.name}`, href: `/admin/corporate/obligations/${obligation.id}`, attention: attentionFor(date, today) });
      }
      return entries;
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const matrixCategories = Array.from(new Set(sites.flatMap((site) => site.serviceCoverage.map((coverage) => coverage.serviceCategory)))).sort();
  const matrixRows: OperationsMatrixRow[] = sites.map((site) => {
    const providers: OperationsMatrixRow["providers"] = {};
    for (const coverage of site.serviceCoverage) {
      providers[coverage.serviceCategory] = [...(providers[coverage.serviceCategory] ?? []), coverage.counterparty];
    }
    return { siteId: site.id, siteCode: site.code, siteName: site.name, providers };
  });

  const gridRows: OperationsGridRow[] = lines.map((line) => {
    const overdueDueCount = line.dueItems.filter((due) => due.status === "OPEN" && formatDateOnly(due.dueDate) < today).length;
    const openDueCount = line.dueItems.filter((due) => due.status === "OPEN").length;
    return {
      id: line.id,
      obligationId: line.obligation.id,
      obligationCode: line.obligation.code,
      obligationTitle: line.obligation.title,
      obligationStatus: line.obligation.status,
      counterparty: line.obligation.counterparty.name,
      lineCode: line.code,
      lineName: line.name,
      lineType: line.lineType,
      lineActive: line.isActive,
      sites: line.obligation.sites.map((link) => link.site.name),
      nextDueDate: line.nextDueDate ? formatDateOnly(line.nextDueDate) : null,
      recurring: line.recurring,
      expectedAmount: line.expectedAmount == null ? null : Number(line.expectedAmount),
      currency: line.currency,
      dueCount: line.dueItems.length,
      openDueCount,
      overdueDueCount,
    };
  });

  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration"
        title="Operations console"
        description="Work from the calendar, coverage matrix or spreadsheet-speed grid without losing the relationships and workflow that make Afenda stronger than a spreadsheet."
        actions={<div className="md:hidden"><CorporateCommandPalette /></div>}
      />
      <CorporateNav />
      <CorporateOperationsConsole agenda={agenda} matrixRows={matrixRows} matrixCategories={matrixCategories} gridRows={gridRows} />
    </AfendaPageFrame>
  );
}

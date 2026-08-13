import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SpreadsheetOperationsWorkspace } from "@/components/corporate/spreadsheet-operations-workspace";
import type { OperationsGridRow, OperationsMatrixRow } from "@/components/corporate/operations-console";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorporateSpreadsheetOperationsPage() {
  const session = await requireWorkspaceUser();
  const today = new Date().toISOString().slice(0, 10);

  const [lines, sites] = await Promise.all([
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
    db.administrativeSite.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const rows: OperationsGridRow[] = lines.map((line) => ({
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
    openDueCount: line.dueItems.filter((due) => due.status === "OPEN").length,
    overdueDueCount: line.dueItems.filter((due) => due.status === "OPEN" && formatDateOnly(due.dueDate) < today).length,
  }));

  const siteOptions: Pick<OperationsMatrixRow, "siteId" | "siteCode" | "siteName">[] = sites.map((site) => ({
    siteId: site.id,
    siteCode: site.code,
    siteName: site.name,
  }));

  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Operations"
        title="Spreadsheet workspace"
        description="Scan, filter, select, edit and copy agreement-line operations at spreadsheet speed while every change still passes Afenda validation, relationship rules, permissions and audit logging."
      />
      <CorporateNav />
      <SpreadsheetOperationsWorkspace rows={rows} sites={siteOptions} isAdmin={session.role === "ADMIN"} />
    </AfendaPageFrame>
  );
}

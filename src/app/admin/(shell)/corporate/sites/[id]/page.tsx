import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaMetricCard } from "@/components/afenda/metric-card";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { AfendaSection } from "@/components/afenda/section";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SiteCoverageManager, type SiteCoverageRow } from "@/components/corporate/site-coverage-manager";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import { Badge } from "@/components/ui/badge";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function renderValue(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspaceUser();
  const { id } = await params;
  const [site, counterparties, definitions] = await Promise.all([
    db.administrativeSite.findUnique({
      where: { id },
      include: {
        serviceCoverage: { orderBy: [{ isActive: "desc" }, { serviceCategory: "asc" }], include: { counterparty: { select: { id: true, code: true, name: true } } } },
        obligations: { where: { isActive: true }, include: { obligation: { include: { counterparty: { select: { name: true } }, dueItems: { where: { status: "OPEN" }, orderBy: { dueDate: "asc" }, take: 1 } } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    db.administrativeCounterparty.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "SITE", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  if (!site) notFound();

  const custom = objectValue(site.customFields);
  const activeCoverage = site.serviceCoverage.filter((item) => item.isActive);
  const obligations = site.obligations.map((link) => link.obligation);
  const activeObligations = obligations.filter((item) => item.status === "ACTIVE");
  const openDueItems = obligations.flatMap((item) => item.dueItems);
  const overdue = openDueItems.filter((due) => deriveDueState(due.status, formatDateOnly(due.dueDate), todayDateOnly()) === "OVERDUE");
  const coverageRows: SiteCoverageRow[] = site.serviceCoverage.map((item) => ({
    id: item.id,
    counterpartyId: item.counterpartyId,
    counterpartyName: item.counterparty.name,
    counterpartyCode: item.counterparty.code,
    serviceCategory: item.serviceCategory,
    roleCode: item.roleCode,
    effectiveFrom: item.effectiveFrom ? formatDateOnly(item.effectiveFrom) : null,
    effectiveTo: item.effectiveTo ? formatDateOnly(item.effectiveTo) : null,
    isPrimary: item.isPrimary,
    isActive: item.isActive,
    serviceLevel: item.serviceLevel,
    emergencyContact: item.emergencyContact,
    notes: item.notes,
  }));

  const address = [site.addressLine1, site.addressLine2, site.postalCode, site.city, site.stateRegion, site.countryCode].filter(Boolean).join(", ");
  const metadata = [
    { label: "Site type", value: site.type.replaceAll("_", " ") },
    { label: "Organisation", value: site.organization ?? "—" },
    { label: "Address", value: address || "—" },
    { label: "Timezone", value: site.timezone ?? "—" },
    ...definitions.map((field) => ({ label: field.label, value: renderValue(custom[field.key]) })),
  ];

  return (
    <AfendaPageFrame width="record">
      <AfendaRecordHeader context="Corporate Administration · Site" title={site.name} identity={`${site.code} · ${site.organization || site.type.replaceAll("_", " ")}`} status={<Badge variant={site.isActive ? "default" : "secondary"}>{site.isActive ? "Active" : "Inactive"}</Badge>} />
      <CorporateNav />

      <section aria-label="Site operating metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AfendaMetricCard label="Active service coverage" value={activeCoverage.length} description="Counterparty-service relationships" />
        <AfendaMetricCard label="Active obligations" value={activeObligations.length} description="Commitments linked to this site" />
        <AfendaMetricCard label="Open due items" value={openDueItems.length} description="Nearest open occurrence per obligation" />
        <AfendaMetricCard label="Overdue attention" value={overdue.length} description="Open items already past due" />
      </section>

      <AfendaSection title="Site profile" description="Canonical location facts and configured site metadata.">
        <AfendaMetadataGrid items={metadata} />
        {site.notes ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{site.notes}</p> : null}
      </AfendaSection>

      <SiteCoverageManager siteId={site.id} rows={coverageRows} counterparties={counterparties} isAdmin={session.role === "ADMIN"} />

      <AfendaSection title="Obligations at this site" description="Many obligations may affect one site, and one obligation may span multiple sites.">
        {site.obligations.length === 0 ? <AfendaEmptyState compact title="No linked obligations" description="Link an obligation to this site from the obligation record to make due dates, evidence and costs visible in site context." /> : <ul className="divide-y">{site.obligations.map((link) => {
          const obligation = link.obligation;
          const due = obligation.dueItems[0];
          const dueState = due ? deriveDueState(due.status, formatDateOnly(due.dueDate), todayDateOnly()) : null;
          return <li key={obligation.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/corporate/obligations/${obligation.id}`} className="font-medium underline-offset-4 hover:underline">{obligation.title}</Link><CorporateStatusBadge status={obligation.status} />{link.scopeRole ? <Badge variant="outline">{link.scopeRole.replaceAll("_", " ")}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{obligation.code} · {obligation.counterparty.name}</p></div><div className="shrink-0 text-right">{due ? <><p className="text-sm font-medium tabular-nums">{formatMoney(due.currency, due.invoiceAmount == null ? due.expectedAmount == null ? null : Number(due.expectedAmount) : Number(due.invoiceAmount))}</p><div className="mt-1 flex items-center justify-end gap-2"><span className="text-xs text-muted-foreground">Due {formatDateOnly(due.dueDate)}</span>{dueState ? <CorporateStatusBadge status={dueState} /> : null}</div></> : <span className="text-sm text-muted-foreground">No open due item</span>}</div></li>;
        })}</ul>}
      </AfendaSection>
    </AfendaPageFrame>
  );
}

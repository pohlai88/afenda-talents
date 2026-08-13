import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaMetricCard } from "@/components/afenda/metric-card";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { AfendaSection } from "@/components/afenda/section";
import { CounterpartyContactManager, type CounterpartyContactRow } from "@/components/corporate/counterparty-contact-manager";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CorporateStatusBadge } from "@/components/corporate/status";
import { Badge } from "@/components/ui/badge";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function renderValue(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }

export default async function CounterpartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspaceUser();
  const { id } = await params;
  const [counterparty, definitions] = await Promise.all([
    db.administrativeCounterparty.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { isActive: "desc" }, { name: "asc" }] },
        serviceCoverage: { orderBy: [{ isActive: "desc" }, { serviceCategory: "asc" }], include: { site: { select: { id: true, code: true, name: true, type: true, isActive: true } } } },
        obligationRoles: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }], include: { obligation: { select: { id: true, code: true, title: true, status: true, category: true } } } },
      },
    }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "COUNTERPARTY", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  if (!counterparty) notFound();

  const custom = objectValue(counterparty.customFields);
  const activeSites = new Set(counterparty.serviceCoverage.filter((coverage) => coverage.isActive && coverage.site.isActive).map((coverage) => coverage.siteId));
  const activeObligations = counterparty.obligationRoles.filter((party) => party.obligation.status === "ACTIVE");
  const contacts: CounterpartyContactRow[] = counterparty.contacts.map((contact) => ({
    id: contact.id, name: contact.name, jobTitle: contact.jobTitle, department: contact.department, email: contact.email, phone: contact.phone, mobile: contact.mobile, role: contact.role, isPrimary: contact.isPrimary, isActive: contact.isActive, notes: contact.notes,
  }));
  const metadata = [
    { label: "Type", value: counterparty.type.replaceAll("_", " ") },
    { label: "Registration no.", value: counterparty.registrationNo ?? "—" },
    { label: "Tax ID", value: counterparty.taxId ?? "—" },
    { label: "Country", value: counterparty.countryCode ?? "—" },
    { label: "Default currency", value: counterparty.defaultCurrency ?? "—" },
    { label: "Payment terms", value: counterparty.paymentTermsDays == null ? "—" : `${counterparty.paymentTermsDays} days` },
    { label: "Website", value: counterparty.websiteUrl ?? "—" },
    { label: "Address", value: counterparty.address ?? "—" },
    ...definitions.map((field) => ({ label: field.label, value: renderValue(custom[field.key]) })),
  ];

  return (
    <AfendaPageFrame width="record">
      <AfendaRecordHeader context="Corporate Administration · Counterparty" title={counterparty.name} identity={`${counterparty.code} · ${counterparty.type.replaceAll("_", " ")}`} status={<Badge variant={counterparty.isActive ? "default" : "secondary"}>{counterparty.isActive ? "Active" : "Inactive"}</Badge>} />
      <CorporateNav />

      <section aria-label="Counterparty operating metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AfendaMetricCard label="Sites served" value={activeSites.size} description="Active location relationships" />
        <AfendaMetricCard label="Active obligations" value={activeObligations.length} description="Current contractual roles" />
        <AfendaMetricCard label="Contacts" value={counterparty.contacts.filter((contact) => contact.isActive).length} description="Active named contacts" />
        <AfendaMetricCard label="Service relationships" value={counterparty.serviceCoverage.filter((coverage) => coverage.isActive).length} description="Service-category coverage links" />
      </section>

      <AfendaSection title="Counterparty profile" description="Canonical party facts and configured metadata.">
        <AfendaMetadataGrid items={metadata} />
        {counterparty.notes ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{counterparty.notes}</p> : null}
      </AfendaSection>

      <CounterpartyContactManager counterpartyId={counterparty.id} rows={contacts} isAdmin={session.role === "ADMIN"} />

      <AfendaSection title="Sites served" description="One counterparty can serve many sites with different service categories and effective periods.">
        {counterparty.serviceCoverage.length === 0 ? <AfendaEmptyState compact title="No site coverage" description="Link this counterparty from a Site 360 workspace to make its operating footprint visible." /> : <ul className="divide-y">{counterparty.serviceCoverage.map((coverage) => <li key={coverage.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/corporate/sites/${coverage.site.id}`} className="font-medium underline-offset-4 hover:underline">{coverage.site.name}</Link><Badge variant={coverage.isActive ? "default" : "secondary"}>{coverage.isActive ? "Active" : "Inactive"}</Badge>{coverage.isPrimary ? <Badge variant="outline">Primary</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{coverage.serviceCategory.replaceAll("_", " ")} · {coverage.site.code}</p></div><p className="text-sm text-muted-foreground">{coverage.effectiveFrom ? formatDateOnly(coverage.effectiveFrom) : "—"} → {coverage.effectiveTo ? formatDateOnly(coverage.effectiveTo) : "open"}</p></li>)}</ul>}
      </AfendaSection>

      <AfendaSection title="Obligation roles" description="A counterparty can be primary, billing entity, broker, agent, insurer or another role across many obligations.">
        {counterparty.obligationRoles.length === 0 ? <AfendaEmptyState compact title="No obligation roles" description="This counterparty is not linked to any obligation role yet." /> : <ul className="divide-y">{counterparty.obligationRoles.map((party) => <li key={`${party.obligationId}-${party.roleCode}`} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/corporate/obligations/${party.obligation.id}`} className="font-medium underline-offset-4 hover:underline">{party.obligation.title}</Link><CorporateStatusBadge status={party.obligation.status} />{party.isPrimary ? <Badge variant="outline">Primary</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{party.obligation.code} · {party.obligation.category.replaceAll("_", " ")}</p></div><Badge variant="secondary">{party.roleCode.replaceAll("_", " ")}</Badge></li>)}</ul>}
      </AfendaSection>
    </AfendaPageFrame>
  );
}

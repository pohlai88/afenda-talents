import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SiteManager, type SiteRow } from "@/components/corporate/site-manager";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function fieldDto(field: Awaited<ReturnType<typeof db.administrativeCustomFieldDefinition.findMany>>[number]): CorporateCustomFieldDefinitionDto {
  return {
    id: field.id,
    scope: field.scope,
    key: field.key,
    label: field.label,
    dataType: field.dataType,
    description: field.description,
    placeholder: field.placeholder,
    required: field.required,
    options: Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [],
    showInList: field.showInList,
    isActive: field.isActive,
    sortOrder: field.sortOrder,
  };
}

export default async function SitesPage() {
  const session = await requireWorkspaceUser();
  const [sites, definitions] = await Promise.all([
    db.administrativeSite.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { _count: { select: { serviceCoverage: true, obligations: true } } } }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "SITE", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);

  const rows: SiteRow[] = sites.map((site) => ({
    id: site.id, code: site.code, name: site.name, type: site.type, organization: site.organization ?? "", addressLine1: site.addressLine1 ?? "", addressLine2: site.addressLine2 ?? "", city: site.city ?? "", stateRegion: site.stateRegion ?? "", postalCode: site.postalCode ?? "", countryCode: site.countryCode ?? "", timezone: site.timezone ?? "", isActive: site.isActive, notes: site.notes ?? "", customFields: objectValue(site.customFields), counterparties: site._count.serviceCoverage, obligations: site._count.obligations,
  }));

  return (
    <AfendaPageFrame width="wide">
      <PageHeader eyebrow="Corporate Administration" title="Sites" description="Model the locations where obligations, service providers and administrative risk actually operate." actions={<AfendaPageHelp title="Sites" guidance={CORPORATE_PAGE_GUIDANCE.sites} />} />
      <CorporateNav />
      <SiteManager rows={rows} definitions={definitions.map(fieldDto)} isAdmin={session.role === "ADMIN"} />
    </AfendaPageFrame>
  );
}

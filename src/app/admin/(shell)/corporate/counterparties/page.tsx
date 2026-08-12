import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CounterpartyManager, type CounterpartyRow } from "@/components/corporate/counterparty-manager";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function fieldDto(field: Awaited<ReturnType<typeof db.administrativeCustomFieldDefinition.findMany>>[number]): CorporateCustomFieldDefinitionDto {
  return { id: field.id, scope: field.scope, key: field.key, label: field.label, dataType: field.dataType, description: field.description, placeholder: field.placeholder, required: field.required, options: Array.isArray(field.options) ? field.options.filter((v): v is string => typeof v === "string") : [], showInList: field.showInList, isActive: field.isActive, sortOrder: field.sortOrder };
}

export default async function CounterpartiesPage() {
  const session = await requireWorkspaceUser();
  const [counterparties, definitions] = await Promise.all([
    db.administrativeCounterparty.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { _count: { select: { obligations: true } } } }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "COUNTERPARTY", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  const rows: CounterpartyRow[] = counterparties.map((row) => ({ id: row.id, code: row.code, name: row.name, type: row.type, registrationNo: row.registrationNo ?? "", taxId: row.taxId ?? "", contactName: row.contactName ?? "", contactEmail: row.contactEmail ?? "", contactPhone: row.contactPhone ?? "", address: row.address ?? "", countryCode: row.countryCode ?? "", websiteUrl: row.websiteUrl ?? "", defaultCurrency: row.defaultCurrency ?? "", paymentTermsDays: row.paymentTermsDays == null ? "" : String(row.paymentTermsDays), isActive: row.isActive, notes: row.notes ?? "", customFields: jsonObject(row.customFields), obligations: row._count.obligations }));
  return (
    <AfendaPageFrame>
      <PageHeader
        eyebrow="Corporate Administration"
        title="Counterparties"
        description="Maintain the landlords, vendors, insurers, financiers, service providers and agencies behind administrative obligations."
        actions={<AfendaPageHelp title="Counterparties" guidance={CORPORATE_PAGE_GUIDANCE.counterparties} />}
      />
      <CorporateNav />
      <CounterpartyManager rows={rows} definitions={definitions.map(fieldDto)} isAdmin={session.role === "ADMIN"} />
    </AfendaPageFrame>
  );
}

import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CounterpartyManager, type CounterpartyRow } from "@/components/corporate/counterparty-manager";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
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
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader eyebrow="Corporate Administration" title="Counterparties" description="Maintain the landlords, vendors, insurers, financiers, service providers and agencies behind administrative obligations." />
      <CorporateNav />
      <CounterpartyManager rows={rows} definitions={definitions.map(fieldDto)} isAdmin={session.role === "ADMIN"} />
    </div>
  );
}

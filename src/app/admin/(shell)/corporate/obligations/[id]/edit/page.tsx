import { notFound } from "next/navigation";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { ObligationForm } from "@/components/corporate/obligation-form";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export default async function EditObligationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireWorkspaceAdmin();
  const { id } = await params;
  const obligation = await db.administrativeObligation.findUnique({ where: { id } });
  if (!obligation) notFound();
  const [counterparties, users, fields] = await Promise.all([
    db.administrativeCounterparty.findMany({ where: { OR: [{ isActive: true }, { id: obligation.counterpartyId }] }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, defaultCurrency: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "OBLIGATION", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  const definitions: CorporateCustomFieldDefinitionDto[] = fields.map((field) => ({ id: field.id, scope: field.scope, key: field.key, label: field.label, dataType: field.dataType, description: field.description, placeholder: field.placeholder, required: field.required, options: Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [], showInList: field.showInList, isActive: field.isActive, sortOrder: field.sortOrder }));
  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader eyebrow="Corporate Administration" title={`Edit ${obligation.code}`} description="Update governing terms or populate newly configured custom fields. Lifecycle status changes stay on the detail screen." />
      <CorporateNav />
      <ObligationForm obligationId={id} counterparties={counterparties.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}`, currency: item.defaultCurrency }))} users={users.map((item) => ({ id: item.id, label: item.name }))} customFields={definitions} initial={{ code: obligation.code, organization: obligation.organization, category: obligation.category, title: obligation.title, counterpartyId: obligation.counterpartyId, assetReference: obligation.assetReference ?? "", ownerId: obligation.ownerId ?? "", startDate: formatDateOnly(obligation.startDate), endDate: obligation.endDate ? formatDateOnly(obligation.endDate) : "", recurring: obligation.recurring, recurrenceInterval: obligation.recurrenceInterval == null ? "1" : String(obligation.recurrenceInterval), recurrenceUnit: obligation.recurrenceUnit ?? "MONTH", expectedAmount: obligation.expectedAmount == null ? "" : String(obligation.expectedAmount), currency: obligation.currency, firstDueDate: obligation.firstDueDate ? formatDateOnly(obligation.firstDueDate) : "", nextDueDate: obligation.nextDueDate ? formatDateOnly(obligation.nextDueDate) : "", autoRenew: obligation.autoRenew, renewalDate: obligation.renewalDate ? formatDateOnly(obligation.renewalDate) : "", noticeDays: obligation.noticeDays == null ? "" : String(obligation.noticeDays), contractRequired: obligation.contractRequired, contractReference: obligation.contractReference ?? "", contractFileUrl: obligation.contractFileUrl ?? "", paymentMethod: obligation.paymentMethod ?? "", notes: obligation.notes ?? "", customFields: objectValue(obligation.customFields) }} />
    </div>
  );
}

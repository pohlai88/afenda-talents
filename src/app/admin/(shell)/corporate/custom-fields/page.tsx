import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CustomFieldCreateForm } from "@/components/corporate/custom-field-create-form";
import { CustomFieldList } from "@/components/corporate/custom-field-list";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CustomFieldsPage() {
  const session = await requireWorkspaceUser();
  const fields = await db.administrativeCustomFieldDefinition.findMany({ orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { label: "asc" }] });
  const rows: CorporateCustomFieldDefinitionDto[] = fields.map((field) => ({
    id: field.id, scope: field.scope, key: field.key, label: field.label, dataType: field.dataType,
    description: field.description, placeholder: field.placeholder, required: field.required,
    options: Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [],
    showInList: field.showInList, isActive: field.isActive, sortOrder: field.sortOrder,
  }));
  return (
    <AfendaPageFrame width="record">
      <PageHeader
        eyebrow="Corporate Administration"
        title="Custom fields"
        description="Extend operational records safely without waiting for a schema migration or development ticket."
        actions={<AfendaPageHelp title="Custom fields" guidance={CORPORATE_PAGE_GUIDANCE.customFields} />}
      />
      <CorporateNav />
      {session.role === "ADMIN" ? <CustomFieldCreateForm /> : null}
      <CustomFieldList fields={rows} isAdmin={session.role === "ADMIN"} />
    </AfendaPageFrame>
  );
}

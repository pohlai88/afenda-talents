import { CorporateNav } from "@/components/corporate/corporate-nav";
import { CustomFieldCreateForm } from "@/components/corporate/custom-field-create-form";
import { CustomFieldList } from "@/components/corporate/custom-field-list";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
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
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader eyebrow="Corporate Administration" title="Custom fields" description="Extend operational records safely without waiting for a schema migration or development ticket." />
      <CorporateNav />
      {session.role === "ADMIN" ? <CustomFieldCreateForm /> : null}
      <CustomFieldList fields={rows} isAdmin={session.role === "ADMIN"} />
    </div>
  );
}

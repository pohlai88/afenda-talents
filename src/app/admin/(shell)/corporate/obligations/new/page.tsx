import Link from "next/link";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { ObligationForm } from "@/components/corporate/obligation-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewObligationPage() {
  await requireWorkspaceAdmin();
  const [counterparties, users, fields] = await Promise.all([
    db.administrativeCounterparty.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true, defaultCurrency: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "OBLIGATION", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  const definitions: CorporateCustomFieldDefinitionDto[] = fields.map((field) => ({ id: field.id, scope: field.scope, key: field.key, label: field.label, dataType: field.dataType, description: field.description, placeholder: field.placeholder, required: field.required, options: Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [], showInList: field.showInList, isActive: field.isActive, sortOrder: field.sortOrder }));
  return (
    <AfendaPageFrame width="form">
      <PageHeader eyebrow="Corporate Administration" title="New obligation" description="Register the governing terms now; recurring due items and payments are managed from the resulting record." />
      <CorporateNav />
      {counterparties.length === 0 ? (
        <Alert><AlertTitle>A counterparty is required</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3">Create the landlord, vendor, insurer, financier or service provider first.<Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/corporate/counterparties" />}>Manage counterparties</Button></AlertDescription></Alert>
      ) : (
        <ObligationForm counterparties={counterparties.map((item) => ({ id: item.id, label: `${item.code} · ${item.name}`, currency: item.defaultCurrency }))} users={users.map((item) => ({ id: item.id, label: item.name }))} customFields={definitions} />
      )}
    </AfendaPageFrame>
  );
}

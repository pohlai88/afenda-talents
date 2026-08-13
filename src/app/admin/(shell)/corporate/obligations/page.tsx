import Link from "next/link";

import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaSection } from "@/components/afenda/section";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { ObligationRegister, type ObligationRegisterRow } from "@/components/corporate/obligation-register";
import { todayDateOnly } from "@/components/corporate/status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly } from "@/lib/corporate-admin/domain";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function customObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function customValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default async function ObligationsPage() {
  const session = await requireWorkspaceUser();
  const [obligations, listFields] = await Promise.all([
    db.administrativeObligation.findMany({
      orderBy: [{ status: "asc" }, { nextDueDate: "asc" }, { createdAt: "desc" }],
      include: { counterparty: { select: { name: true } }, owner: { select: { name: true } }, dueItems: { where: { status: "OPEN" }, orderBy: { dueDate: "asc" }, take: 1 } },
    }),
    db.administrativeCustomFieldDefinition.findMany({ where: { scope: "OBLIGATION", isActive: true, showInList: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], take: 4 }),
  ]);
  const today = todayDateOnly();

  const rows: ObligationRegisterRow[] = obligations.map((row) => {
    const openDue = row.dueItems[0];
    const nextAttentionDate = openDue ? formatDateOnly(openDue.dueDate) : row.nextDueDate ? formatDateOnly(row.nextDueDate) : null;
    const attentionState = nextAttentionDate ? deriveDueState("OPEN", nextAttentionDate, today) : null;
    const extras = customObject(row.customFields);
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      organization: row.organization,
      category: row.category,
      counterpartyName: row.counterparty.name,
      status: row.status,
      nextAttentionDate,
      attentionState,
      currency: row.currency,
      expectedAmount: row.expectedAmount == null ? null : Number(row.expectedAmount),
      ownerName: row.owner?.name ?? null,
      customFields: Object.fromEntries(listFields.map((field) => [field.key, customValue(extras[field.key])])),
    };
  });

  return (
    <AfendaPageFrame>
      <PageHeader
        eyebrow="Corporate Administration"
        title="Obligations"
        description="One register for tenancy, subscriptions, insurance, fleet, maintenance, licences and other administrative commitments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AfendaPageHelp title="Obligations register" guidance={CORPORATE_PAGE_GUIDANCE.obligations} />
            {session.role === "ADMIN" ? <Button nativeButton={false} render={<Link href="/admin/corporate/obligations/new" />}>New obligation</Button> : null}
          </div>
        }
      />
      <CorporateNav />
      <AfendaSection title="Register" description="Search and filter records, then open one for its terms, due schedule and payment history.">
        {rows.length === 0 ? (
          <AfendaEmptyState
            title="No obligations yet"
            description="Add your first recurring or one-off administrative commitment."
            action={session.role === "ADMIN" ? <Button size="sm" nativeButton={false} render={<Link href="/admin/corporate/obligations/new" />}>Create obligation</Button> : undefined}
          />
        ) : (
          <ObligationRegister rows={rows} listFields={listFields.map((field) => ({ id: field.id, key: field.key, label: field.label }))} />
        )}
      </AfendaSection>
    </AfendaPageFrame>
  );
}

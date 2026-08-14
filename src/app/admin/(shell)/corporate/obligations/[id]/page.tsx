import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaActivityTimeline, type AfendaActivityItem } from "@/components/afenda/activity-timeline";
import { AfendaEvidenceList } from "@/components/afenda/evidence-list";
import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaMetadataGrid, type AfendaMetadataItem } from "@/components/afenda/metadata-grid";
import { AfendaNextAction } from "@/components/afenda/next-action";
import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaReadinessChecklist } from "@/components/afenda/readiness-checklist";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaWorkflowStepper, type AfendaWorkflowStep } from "@/components/afenda/workflow-stepper";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { DueItemPanel } from "@/components/corporate/due-item-panel";
import { ObligationActions } from "@/components/corporate/obligation-actions";
import { ObligationRelationshipManager } from "@/components/corporate/obligation-relationship-manager";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import type { DueItemDto } from "@/components/corporate/workflow-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auditActionLabel, formatAuditMeta } from "@/lib/audit-display";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly } from "@/lib/corporate-admin/domain";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { obligationCanActivate, obligationNextAction, obligationReadiness, type ObligationUiInput } from "@/lib/corporate-admin/ui-state";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function fieldDto(field: { id: string; scope: "COUNTERPARTY" | "SITE" | "OBLIGATION" | "DUE_ITEM" | "PAYMENT"; key: string; label: string; dataType: "TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT" | "URL" | "EMAIL" | "PHONE"; description: string | null; placeholder: string | null; required: boolean; options: unknown; showInList: boolean; isActive: boolean; sortOrder: number }): CorporateCustomFieldDefinitionDto { return { ...field, options: Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [] }; }
function renderValue(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }

function formatActivityTime(value: Date): string {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(value);
}
function activityContext(action: string): string {
  if (action.includes("payment")) return "Payment";
  if (action.includes("due_item")) return "Due item";
  if (action.includes("site")) return "Site";
  if (action.includes("party")) return "Relationship";
  return "Obligation";
}
function auditMetaLabel(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

function latestWorkflowSteps(status: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED", dueItems: DueItemDto[]): AfendaWorkflowStep[] {
  const due = dueItems[0];
  const payment = due?.payments[0];
  const obligationComplete = status !== "DRAFT";
  const dueComplete = Boolean(due);
  const settlementComplete = Boolean(payment && (payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID"));
  const reconciliationComplete = Boolean(payment?.reconciledAt);
  const reconciliationCurrent = settlementComplete && !reconciliationComplete;

  if (payment && payment.recordOrigin !== "WORKFLOW") {
    return [
      { label: "Obligation", description: "Register and activate terms", state: obligationComplete ? "complete" : "current" },
      { label: "Due item", description: "Materialise or import the charge", state: dueComplete ? "complete" : "current" },
      { label: "History", description: payment.recordOrigin === "HISTORICAL_IMPORT" ? "Imported legacy settlement" : "Recorded legacy settlement", state: "complete" },
      { label: "Payment", description: "Actual historical settlement", state: settlementComplete ? "complete" : "current" },
      { label: "Reconcile", description: "Post-payment verification", state: reconciliationComplete ? "complete" : reconciliationCurrent ? "current" : "upcoming" },
    ];
  }

  const requestComplete = Boolean(payment);
  const approvalComplete = Boolean(payment && payment.approvalStatus !== "PENDING");
  const approvalCurrent = Boolean(payment && payment.approvalStatus === "PENDING");
  const settlementCurrent = Boolean(payment && payment.approvalStatus === "APPROVED" && payment.paymentStatus === "NOT_PAID");
  return [
    { label: "Obligation", description: "Register and activate terms", state: obligationComplete ? "complete" : "current" },
    { label: "Due item", description: "Materialise the charge", state: !obligationComplete ? "upcoming" : dueComplete ? "complete" : "current" },
    { label: "Request", description: "Request settlement", state: !dueComplete ? "upcoming" : requestComplete ? "complete" : "current" },
    { label: "Approval", description: "Approve or reject", state: !requestComplete ? "upcoming" : approvalCurrent ? "current" : approvalComplete ? "complete" : "upcoming" },
    { label: "Payment", description: "Record actual settlement", state: settlementComplete ? "complete" : settlementCurrent ? "current" : "upcoming" },
    { label: "Reconcile", description: "Post-payment verification", state: reconciliationComplete ? "complete" : reconciliationCurrent ? "current" : "upcoming" },
  ];
}

export default async function ObligationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireWorkspaceUser();
  const { id } = await params;
  const [obligation, definitions, siteOptions, counterpartyOptions] = await Promise.all([
    db.administrativeObligation.findUnique({
      where: { id },
      include: {
        counterparty: true,
        owner: { select: { name: true } },
        dueItems: { orderBy: { dueDate: "desc" }, include: { payments: { orderBy: { requestDate: "desc" } } } },
        sites: { orderBy: { createdAt: "asc" }, include: { site: { select: { id: true, code: true, name: true, type: true } } } },
        parties: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], include: { counterparty: { select: { id: true, code: true, name: true } } } },
      },
    }),
    db.administrativeCustomFieldDefinition.findMany({ where: { isActive: true, scope: { in: ["OBLIGATION", "DUE_ITEM", "PAYMENT"] } }, orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }),
    db.administrativeSite.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    db.administrativeCounterparty.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  if (!obligation) notFound();

  const paymentIds = obligation.dueItems.flatMap((due) => due.payments.map((payment) => payment.id));
  const historicalPaymentRows = paymentIds.length > 0
    ? await db.administrativeHistoricalPayment.findMany({ where: { paymentId: { in: paymentIds } }, select: { paymentId: true, origin: true, approvalRequired: true } })
    : [];
  const historicalPayments = new Map(historicalPaymentRows.map((row) => [row.paymentId, row]));

  const isAdmin = session.role === "ADMIN";
  const dueFields = definitions.filter((field) => field.scope === "DUE_ITEM").map(fieldDto);
  const paymentFields = definitions.filter((field) => field.scope === "PAYMENT").map(fieldDto);
  const obligationFields = definitions.filter((field) => field.scope === "OBLIGATION");
  const obligationCustom = objectValue(obligation.customFields);
  const dueItems: DueItemDto[] = obligation.dueItems.map((due) => ({
    id: due.id, periodLabel: due.periodLabel, dueDate: formatDateOnly(due.dueDate), expectedAmount: due.expectedAmount == null ? null : Number(due.expectedAmount), invoiceAmount: due.invoiceAmount == null ? null : Number(due.invoiceAmount), currency: due.currency, invoiceRequired: due.invoiceRequired, invoiceNumber: due.invoiceNumber, invoiceFileUrl: due.invoiceFileUrl, status: due.status, disputeFlag: due.disputeFlag, notes: due.notes, customFields: objectValue(due.customFields),
    payments: due.payments.map((payment) => {
      const history = historicalPayments.get(payment.id);
      return {
        id: payment.id,
        requestedAmount: Number(payment.requestedAmount),
        approvalStatus: payment.approvalStatus,
        approvedAmount: payment.approvedAmount == null ? null : Number(payment.approvedAmount),
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount == null ? null : Number(payment.paidAmount),
        paymentDate: payment.paymentDate ? payment.paymentDate.toISOString().slice(0, 10) : null,
        paymentMethod: payment.paymentMethod,
        paymentReference: payment.paymentReference,
        paymentProofUrl: payment.paymentProofUrl,
        reconciledAt: payment.reconciledAt?.toISOString() ?? null,
        notes: payment.notes,
        customFields: objectValue(payment.customFields),
        recordOrigin: history?.origin ?? "WORKFLOW",
        approvalRequired: history?.approvalRequired ?? true,
      };
    }),
  }));

  const subjectIds = [id, ...dueItems.map((due) => due.id), ...dueItems.flatMap((due) => due.payments.map((payment) => payment.id))];
  const auditEvents = await db.auditEvent.findMany({ where: { subjectId: { in: subjectIds }, action: { startsWith: "corporate." } }, orderBy: { createdAt: "desc" }, take: 30 });
  const actorIds = Array.from(new Set(auditEvents.map((event) => event.actor)));
  const actors = actorIds.length > 0 ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));
  const activity: AfendaActivityItem[] = auditEvents.map((event) => ({
    id: event.id,
    title: auditActionLabel(event.action).replace("Administrative ", ""),
    timestamp: formatActivityTime(event.createdAt),
    actor: actorNames.get(event.actor) ?? "Workspace user",
    context: activityContext(event.action),
    metadata: formatAuditMeta(event.meta).map(({ key, value }) => ({ label: auditMetaLabel(key), value })),
  }));

  const today = todayDateOnly();
  const requiredCustomFields = obligationFields.filter((field) => field.required).map((field) => ({ key: field.key, label: field.label }));
  const overdueDueItems = dueItems.filter((due) => due.status === "OPEN" && deriveDueState(due.status, due.dueDate, today) === "OVERDUE").length;
  const allPayments = dueItems.flatMap((due) => due.payments);
  const pendingApprovals = allPayments.filter((payment) => payment.approvalRequired && payment.approvalStatus === "PENDING").length;
  const unreconciledPayments = allPayments.filter((payment) => (payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID") && !payment.reconciledAt).length;
  const uiInput: ObligationUiInput = {
    status: obligation.status,
    counterpartyActive: obligation.counterparty.isActive,
    startDate: formatDateOnly(obligation.startDate),
    currency: obligation.currency,
    ownerAssigned: Boolean(obligation.owner),
    recurring: obligation.recurring,
    recurrenceInterval: obligation.recurrenceInterval,
    recurrenceUnit: obligation.recurrenceUnit,
    nextDueDate: obligation.nextDueDate ? formatDateOnly(obligation.nextDueDate) : null,
    contractRequired: obligation.contractRequired,
    contractFileUrl: obligation.contractFileUrl,
    requiredCustomFields,
    customFields: obligationCustom,
    overdueDueItems,
    pendingApprovals,
    unreconciledPayments,
  };
  const readiness = obligationReadiness(uiInput);
  const canActivate = obligationCanActivate(uiInput);
  const nextAction = obligationNextAction(uiInput);

  const termItems: AfendaMetadataItem[] = [
    { label: "Category", value: obligation.category.replaceAll("_", " ") },
    { label: "Primary counterparty", value: obligation.counterparty.name },
    { label: "Owner", value: obligation.owner?.name ?? "—" },
    { label: "Legacy asset / location reference", value: obligation.assetReference ?? "—" },
    { label: "Start", value: formatDateOnly(obligation.startDate) },
    { label: "End", value: obligation.endDate ? formatDateOnly(obligation.endDate) : "Open-ended" },
    { label: "Expected amount", value: formatMoney(obligation.currency, obligation.expectedAmount == null ? null : Number(obligation.expectedAmount)) },
    { label: "Next due", value: obligation.nextDueDate ? formatDateOnly(obligation.nextDueDate) : "—" },
    { label: "Schedule", value: obligation.recurring && obligation.recurrenceInterval && obligation.recurrenceUnit ? `Every ${obligation.recurrenceInterval} ${obligation.recurrenceUnit.toLowerCase()}${obligation.recurrenceInterval === 1 ? "" : "s"}` : "One-off / manual" },
    { label: "Renewal", value: obligation.renewalDate ? formatDateOnly(obligation.renewalDate) : obligation.autoRenew ? "Auto-renew enabled" : "—" },
    { label: "Notice", value: obligation.noticeDays == null ? "—" : `${obligation.noticeDays} days` },
    { label: "Payment method", value: obligation.paymentMethod?.replaceAll("_", " ") ?? "—" },
    ...obligationFields.map((field) => ({ label: field.label, value: renderValue(obligationCustom[field.key]) })),
  ];

  const relationshipSites = obligation.sites.map((link) => ({ id: link.site.id, code: link.site.code, name: link.site.name, type: link.site.type, scopeRole: link.scopeRole, isActive: link.isActive, notes: link.notes }));
  const relationshipParties = obligation.parties.map((party) => ({ counterpartyId: party.counterpartyId, code: party.counterparty.code, name: party.counterparty.name, roleCode: party.roleCode, isPrimary: party.isPrimary, effectiveFrom: party.effectiveFrom ? formatDateOnly(party.effectiveFrom) : null, effectiveTo: party.effectiveTo ? formatDateOnly(party.effectiveTo) : null, isActive: party.isActive, notes: party.notes }));
  const latestDue = dueItems[0];
  const latestPayment = latestDue?.payments[0];

  const headerActions = <div className="flex flex-wrap items-center gap-2"><AfendaPageHelp title="Obligation record" guidance={CORPORATE_PAGE_GUIDANCE.obligations} />{isAdmin ? <Button variant="outline" nativeButton={false} render={<Link href={`/admin/corporate/obligations/${id}/edit`} />}>Edit terms</Button> : null}</div>;

  return (
    <AfendaPageFrame width="record" reserveMobileActions={isAdmin && (obligation.status === "DRAFT" || obligation.status === "ACTIVE")}>
      <AfendaRecordHeader context="Corporate Administration" title={obligation.title} identity={`${obligation.code} · ${obligation.organization} · ${obligation.counterparty.name}`} status={<CorporateStatusBadge status={obligation.status} />} actions={headerActions} />
      <CorporateNav />

      <AfendaNextAction action={nextAction.action} why={nextAction.why} who={nextAction.who} tone={nextAction.tone}>
        <ObligationActions id={id} status={obligation.status} recurring={obligation.recurring} nextDueDate={obligation.nextDueDate ? formatDateOnly(obligation.nextDueDate) : null} currency={obligation.currency} expectedAmount={obligation.expectedAmount == null ? null : Number(obligation.expectedAmount)} isAdmin={isAdmin} canActivate={canActivate} />
      </AfendaNextAction>

      <AfendaSection title="Operational workflow" description={dueItems.length > 0 ? "Current progress for the latest due/payment cycle." : "The normal path from obligation setup through final reconciliation."}>
        <AfendaWorkflowStepper steps={latestWorkflowSteps(obligation.status, dueItems)} />
      </AfendaSection>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card><CardHeader><CardTitle>Terms & metadata</CardTitle><CardDescription>Governing dates, recurrence, commercial terms and configured record metadata.</CardDescription></CardHeader><CardContent><AfendaMetadataGrid items={termItems} /></CardContent></Card>
        <div className="grid gap-6">
          <AfendaReadinessChecklist title="Record readiness" description={obligation.status === "DRAFT" ? "Resolve required items before activation." : "Ongoing quality checks for this operational record."} items={readiness} />
          <AfendaEvidenceList title="Evidence & references" description="Primary contract and latest operational evidence at a glance. Full evidence remains on each due item below." items={[
            { label: "Contract document", reference: obligation.contractReference, href: obligation.contractFileUrl, required: obligation.contractRequired, note: obligation.contractRequired ? "Required by this obligation before activation." : "Optional contract or agreement evidence." },
            ...(latestDue ? [{ label: "Latest invoice / support", reference: latestDue.invoiceNumber, href: latestDue.invoiceFileUrl, required: latestDue.invoiceRequired, note: `Latest due item: ${latestDue.periodLabel}.` }] : []),
            ...(latestPayment && (latestPayment.paymentReference || latestPayment.paymentProofUrl) ? [{ label: "Latest payment evidence", reference: latestPayment.paymentReference, href: latestPayment.paymentProofUrl, note: latestPayment.paymentDate ? `Settlement recorded ${latestPayment.paymentDate}.` : "Latest settlement evidence." }] : []),
          ]} />
          {obligation.notes ? <Card><CardHeader><CardTitle>Record notes</CardTitle><CardDescription>Operational context that does not belong in a structured field.</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{obligation.notes}</p></CardContent></Card> : null}
        </div>
      </div>

      <ObligationRelationshipManager obligationId={id} sites={relationshipSites} parties={relationshipParties} siteOptions={siteOptions} counterpartyOptions={counterpartyOptions} isAdmin={isAdmin} />

      <AfendaSection title="Due schedule & payments" description="Each due item keeps its own invoice evidence, dispute flag and payment history.">
        {dueItems.length === 0 ? <AfendaEmptyState title="No due items yet" description={obligation.status === "ACTIVE" ? "Generate the next scheduled due or add one manually." : "Activate the obligation first."} /> : <div className="flex flex-col gap-4">{dueItems.map((due) => <DueItemPanel key={due.id} dueItem={due} dueFields={dueFields} paymentFields={paymentFields} isAdmin={isAdmin} />)}</div>}
      </AfendaSection>

      <AfendaActivityTimeline items={activity} title="Activity history" description="Audit-backed changes across this obligation, its relationships, due items and payment records." />
    </AfendaPageFrame>
  );
}

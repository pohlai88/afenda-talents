import Link from "next/link";
import { notFound } from "next/navigation";

import { AfendaPageHelp } from "@/components/afenda/guidance-sheet";
import { AfendaNextAction } from "@/components/afenda/next-action";
import { AfendaReadinessChecklist } from "@/components/afenda/readiness-checklist";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaWorkflowStepper, type AfendaWorkflowStep } from "@/components/afenda/workflow-stepper";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { DueItemPanel } from "@/components/corporate/due-item-panel";
import { ObligationActions } from "@/components/corporate/obligation-actions";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import type { DueItemDto } from "@/components/corporate/workflow-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { deriveDueState, formatDateOnly } from "@/lib/corporate-admin/domain";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { obligationCanActivate, obligationNextAction, obligationReadiness, type ObligationUiInput } from "@/lib/corporate-admin/ui-state";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function fieldDto(field: { id: string; scope: "COUNTERPARTY" | "OBLIGATION" | "DUE_ITEM" | "PAYMENT"; key: string; label: string; dataType: "TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT" | "URL" | "EMAIL" | "PHONE"; description: string | null; placeholder: string | null; required: boolean; options: unknown; showInList: boolean; isActive: boolean; sortOrder: number }): CorporateCustomFieldDefinitionDto { return { ...field, options: Array.isArray(field.options) ? field.options.filter((value): value is string => typeof value === "string") : [] }; }
function renderValue(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }

function latestWorkflowSteps(status: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED", dueItems: DueItemDto[]): AfendaWorkflowStep[] {
  const due = dueItems[0];
  const payment = due?.payments[0];
  const obligationComplete = status !== "DRAFT";
  const dueComplete = Boolean(due);
  const requestComplete = Boolean(payment);
  const approvalComplete = Boolean(payment && payment.approvalStatus !== "PENDING");
  const approvalCurrent = Boolean(payment && payment.approvalStatus === "PENDING");
  const settlementComplete = Boolean(payment && (payment.paymentStatus === "PAID" || payment.paymentStatus === "PARTIALLY_PAID"));
  const settlementCurrent = Boolean(payment && payment.approvalStatus === "APPROVED" && payment.paymentStatus === "NOT_PAID");
  const reconciliationComplete = Boolean(payment?.reconciledAt);
  const reconciliationCurrent = settlementComplete && !reconciliationComplete;

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
  const [obligation, definitions] = await Promise.all([
    db.administrativeObligation.findUnique({
      where: { id },
      include: {
        counterparty: true,
        owner: { select: { name: true } },
        dueItems: { orderBy: { dueDate: "desc" }, include: { payments: { orderBy: { requestDate: "desc" } } } },
      },
    }),
    db.administrativeCustomFieldDefinition.findMany({ where: { isActive: true, scope: { in: ["OBLIGATION", "DUE_ITEM", "PAYMENT"] } }, orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  if (!obligation) notFound();
  const isAdmin = session.role === "ADMIN";
  const dueFields = definitions.filter((field) => field.scope === "DUE_ITEM").map(fieldDto);
  const paymentFields = definitions.filter((field) => field.scope === "PAYMENT").map(fieldDto);
  const obligationFields = definitions.filter((field) => field.scope === "OBLIGATION");
  const obligationCustom = objectValue(obligation.customFields);
  const dueItems: DueItemDto[] = obligation.dueItems.map((due) => ({
    id: due.id, periodLabel: due.periodLabel, dueDate: formatDateOnly(due.dueDate), expectedAmount: due.expectedAmount == null ? null : Number(due.expectedAmount), invoiceAmount: due.invoiceAmount == null ? null : Number(due.invoiceAmount), currency: due.currency, invoiceRequired: due.invoiceRequired, invoiceNumber: due.invoiceNumber, invoiceFileUrl: due.invoiceFileUrl, status: due.status, disputeFlag: due.disputeFlag, notes: due.notes, customFields: objectValue(due.customFields),
    payments: due.payments.map((payment) => ({ id: payment.id, requestedAmount: Number(payment.requestedAmount), approvalStatus: payment.approvalStatus, approvedAmount: payment.approvedAmount == null ? null : Number(payment.approvedAmount), paymentStatus: payment.paymentStatus, paidAmount: payment.paidAmount == null ? null : Number(payment.paidAmount), paymentDate: payment.paymentDate ? payment.paymentDate.toISOString().slice(0, 10) : null, paymentMethod: payment.paymentMethod, paymentReference: payment.paymentReference, paymentProofUrl: payment.paymentProofUrl, reconciledAt: payment.reconciledAt?.toISOString() ?? null, notes: payment.notes, customFields: objectValue(payment.customFields) })),
  }));

  const today = todayDateOnly();
  const requiredCustomFields = obligationFields.filter((field) => field.required).map((field) => ({ key: field.key, label: field.label }));
  const overdueDueItems = dueItems.filter((due) => due.status === "OPEN" && deriveDueState(due.status, due.dueDate, today) === "OVERDUE").length;
  const allPayments = dueItems.flatMap((due) => due.payments);
  const pendingApprovals = allPayments.filter((payment) => payment.approvalStatus === "PENDING").length;
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

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <AfendaPageHelp title="Obligation record" guidance={CORPORATE_PAGE_GUIDANCE.obligations} />
      {isAdmin ? <Button variant="outline" nativeButton={false} render={<Link href={`/admin/corporate/obligations/${id}/edit`} />}>Edit terms</Button> : null}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <AfendaRecordHeader context="Corporate Administration" title={obligation.title} identity={`${obligation.code} · ${obligation.organization} · ${obligation.counterparty.name}`} status={<CorporateStatusBadge status={obligation.status} />} actions={headerActions} />
      <CorporateNav />

      <AfendaNextAction action={nextAction.action} why={nextAction.why} who={nextAction.who} tone={nextAction.tone}>
        <ObligationActions id={id} status={obligation.status} recurring={obligation.recurring} nextDueDate={obligation.nextDueDate ? formatDateOnly(obligation.nextDueDate) : null} currency={obligation.currency} expectedAmount={obligation.expectedAmount == null ? null : Number(obligation.expectedAmount)} isAdmin={isAdmin} canActivate={canActivate} />
      </AfendaNextAction>

      <AfendaSection title="Operational workflow" description={dueItems.length > 0 ? "Current progress for the latest due/payment cycle." : "The normal path from obligation setup through final reconciliation."}>
        <AfendaWorkflowStepper steps={latestWorkflowSteps(obligation.status, dueItems)} />
      </AfendaSection>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card><CardHeader><CardTitle>Terms</CardTitle><CardDescription>Governing dates, recurrence and money.</CardDescription></CardHeader><CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label="Category" value={obligation.category.replaceAll("_", " ")} /><Fact label="Counterparty" value={obligation.counterparty.name} /><Fact label="Owner" value={obligation.owner?.name ?? "—"} /><Fact label="Asset / location" value={obligation.assetReference ?? "—"} /><Fact label="Start" value={formatDateOnly(obligation.startDate)} /><Fact label="End" value={obligation.endDate ? formatDateOnly(obligation.endDate) : "Open-ended"} /><Fact label="Expected amount" value={formatMoney(obligation.currency, obligation.expectedAmount == null ? null : Number(obligation.expectedAmount))} /><Fact label="Next due" value={obligation.nextDueDate ? formatDateOnly(obligation.nextDueDate) : "—"} /><Fact label="Schedule" value={obligation.recurring && obligation.recurrenceInterval && obligation.recurrenceUnit ? `Every ${obligation.recurrenceInterval} ${obligation.recurrenceUnit.toLowerCase()}${obligation.recurrenceInterval === 1 ? "" : "s"}` : "One-off / manual"} /><Fact label="Renewal" value={obligation.renewalDate ? formatDateOnly(obligation.renewalDate) : obligation.autoRenew ? "Auto-renew enabled" : "—"} /><Fact label="Notice" value={obligation.noticeDays == null ? "—" : `${obligation.noticeDays} days`} /><Fact label="Payment method" value={obligation.paymentMethod?.replaceAll("_", " ") ?? "—"} />
          {obligationFields.map((field) => <Fact key={field.id} label={field.label} value={renderValue(obligationCustom[field.key])} />)}
        </CardContent></Card>
        <div className="grid gap-6">
          <AfendaReadinessChecklist title="Record readiness" description={obligation.status === "DRAFT" ? "Resolve required items before activation." : "Ongoing quality checks for this operational record."} items={readiness} />
          <Card><CardHeader><CardTitle>Contract & references</CardTitle><CardDescription>Source evidence and administrative references.</CardDescription></CardHeader><CardContent className="space-y-4"><Fact label="Contract required" value={obligation.contractRequired ? "Yes" : "No"} /><Fact label="Contract reference" value={obligation.contractReference ?? "—"} />{obligation.contractFileUrl ? <div><p className="text-xs text-muted-foreground">Contract document</p><a href={obligation.contractFileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4">Open linked document</a></div> : <Fact label="Contract document" value="—" />}<Fact label="Notes" value={obligation.notes ?? "—"} /></CardContent></Card>
        </div>
      </div>

      <AfendaSection title="Due schedule & payments" description="Each due item keeps its own invoice evidence, dispute flag and payment history.">
        {dueItems.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No due items yet. {obligation.status === "ACTIVE" ? "Generate the next scheduled due or add one manually." : "Activate the obligation first."}</CardContent></Card> : <div className="space-y-4">{dueItems.map((due) => <DueItemPanel key={due.id} dueItem={due} dueFields={dueFields} paymentFields={paymentFields} isAdmin={isAdmin} />)}</div>}
      </AfendaSection>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>; }

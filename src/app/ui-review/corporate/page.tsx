import { AfendaActivityTimeline } from "@/components/afenda/activity-timeline";
import { AfendaEvidenceList } from "@/components/afenda/evidence-list";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaNextAction } from "@/components/afenda/next-action";
import { AfendaReadinessChecklist } from "@/components/afenda/readiness-checklist";
import { AfendaRecordHeader } from "@/components/afenda/record-header";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaWorkflowStepper } from "@/components/afenda/workflow-stepper";
import { CorporateStatusBadge } from "@/components/corporate/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function CorporateUiReviewPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground">UI-03 · CORPORATE ADMINISTRATION REVIEW</p>
          <Badge variant="outline">Static review data</Badge>
        </div>

        <AfendaRecordHeader
          context="Corporate Administration"
          title="Klang Office Tenancy"
          identity="ADM-2026-018 · DLBB · Meridian Properties Sdn Bhd"
          status={<CorporateStatusBadge status="ACTIVE" />}
          actions={<Button variant="outline">Edit terms</Button>}
        />

        <AfendaNextAction
          action="Review and reconcile the latest payment"
          why="The August rental payment has been recorded, but post-payment verification is still outstanding."
          who="Corporate administrator"
          tone="attention"
        >
          <div className="flex flex-wrap gap-2">
            <Button>Review payment</Button>
            <Button variant="outline">Open evidence</Button>
          </div>
        </AfendaNextAction>

        <AfendaSection title="Operational workflow" description="Current progress for the latest due/payment cycle.">
          <AfendaWorkflowStepper steps={[
            { label: "Obligation", description: "Terms active", state: "complete" },
            { label: "Due item", description: "August rent", state: "complete" },
            { label: "Request", description: "Settlement requested", state: "complete" },
            { label: "Approval", description: "Approved", state: "complete" },
            { label: "Payment", description: "Recorded", state: "complete" },
            { label: "Reconcile", description: "Verification due", state: "current" },
          ]} />
        </AfendaSection>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <AfendaSection title="Terms & metadata" description="Governing dates, recurrence, commercial terms and record metadata.">
            <AfendaMetadataGrid items={[
              { label: "Category", value: "Tenancy" },
              { label: "Counterparty", value: "Meridian Properties Sdn Bhd" },
              { label: "Owner", value: "Corporate Administration" },
              { label: "Asset / location", value: "Klang HQ · Level 2" },
              { label: "Start", value: "01 Jan 2026" },
              { label: "End", value: "31 Dec 2027" },
              { label: "Expected amount", value: "MYR 15,000.00" },
              { label: "Next due", value: "01 Sep 2026" },
              { label: "Schedule", value: "Every 1 month" },
              { label: "Renewal", value: "01 Jan 2028" },
              { label: "Notice", value: "90 days" },
              { label: "Payment method", value: "Bank transfer" },
            ]} />
          </AfendaSection>

          <div className="flex flex-col gap-6">
            <AfendaReadinessChecklist
              title="Record readiness"
              description="Ongoing quality checks for this operational record."
              items={[
                { label: "Counterparty active", detail: "Meridian Properties Sdn Bhd", state: "ready" },
                { label: "Contract evidence available", detail: "Signed tenancy agreement linked", state: "ready" },
                { label: "Recurrence schedule valid", detail: "Monthly · next due 01 Sep 2026", state: "ready" },
                { label: "Payment reconciliation", detail: "August settlement still requires verification", state: "attention" },
              ]}
            />
            <AfendaEvidenceList
              items={[
                { label: "Contract document", reference: "TA-KLG-2026-018", href: "https://example.com/tenancy.pdf", required: true, note: "Signed tenancy agreement." },
                { label: "Latest invoice / support", reference: "INV-0826-4481", href: "https://example.com/invoice.pdf", required: true, note: "August 2026 rental invoice." },
                { label: "Latest payment evidence", reference: "HLB-20260812-88420", href: "https://example.com/payment.pdf", note: "Settlement recorded 12 Aug 2026." },
              ]}
            />
          </div>
        </div>

        <AfendaSection title="Due schedule & payments" description="Each occurrence keeps invoice, settlement and reconciliation facts separate.">
          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">August 2026</h3>
                  <CorporateStatusBadge status="COMPLETED" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Due 01 Aug 2026 · MYR 15,000.00</p>
              </div>
              <Button size="sm" variant="outline">View payment</Button>
            </div>
            <AfendaMetadataGrid
              columns={3}
              className="mt-4 rounded-lg bg-muted/30 p-3"
              items={[
                { label: "Invoice number", value: "INV-0826-4481" },
                { label: "Approved", value: "MYR 15,000.00" },
                { label: "Paid", value: "MYR 15,000.00" },
              ]}
            />
          </div>
        </AfendaSection>

        <AfendaActivityTimeline
          title="Activity history"
          description="Audit-backed changes across this obligation, due items and payment records."
          items={[
            { id: "1", title: "Payment recorded", actor: "Jack Wee", timestamp: "12 Aug 2026, 8:42 PM", context: "Payment", detail: "Settlement evidence and banking reference were recorded." },
            { id: "2", title: "Payment approved", actor: "Jack Wee", timestamp: "12 Aug 2026, 4:18 PM", context: "Payment" },
            { id: "3", title: "Payment requested", actor: "Corporate Administrator", timestamp: "12 Aug 2026, 3:55 PM", context: "Payment" },
            { id: "4", title: "Due item updated", actor: "Corporate Administrator", timestamp: "11 Aug 2026, 5:24 PM", context: "Due item", detail: "Invoice number and supporting evidence were added." },
            { id: "5", title: "Obligation activated", actor: "Jack Wee", timestamp: "02 Jan 2026, 9:10 AM", context: "Obligation" },
          ]}
        />
      </div>
    </main>
  );
}

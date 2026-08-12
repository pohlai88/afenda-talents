import Link from "next/link";

import { AfendaSection } from "@/components/afenda/section";
import { AfendaWorkflowStepper } from "@/components/afenda/workflow-stepper";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceUser } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

const chapters = [
  ["obligations", "Obligations"],
  ["due-items", "Due items & invoices"],
  ["payments", "Payments"],
  ["counterparties", "Counterparties"],
  ["custom-fields", "Custom fields"],
] as const;

function ManualRule({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-muted/20 p-4"><p className="text-sm font-medium">{title}</p><div className="mt-1 text-sm leading-6 text-muted-foreground">{children}</div></div>;
}

export default async function CorporateHelpPage() {
  await requireWorkspaceUser();
  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Corporate Administration"
        title="Help & operating manual"
        description="Practical guidance for registering obligations, managing due items and invoices, controlling payments, and extending records safely."
        actions={<Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate" />}>Back to overview</Button>}
      />
      <CorporateNav />

      <nav aria-label="Manual chapters" className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-3">
        {chapters.map(([id, label]) => <Button key={id} size="sm" variant="outline" nativeButton={false} render={<Link href={`#${id}`} />}>{label}</Button>)}
      </nav>

      <AfendaSection title="The operating model" description="Corporate Administration is an operational control register, not the accounting ledger.">
        <AfendaWorkflowStepper steps={[
          { label: "Obligation", description: "Record terms and evidence", state: "complete" },
          { label: "Due item", description: "Materialise each occurrence", state: "complete" },
          { label: "Request", description: "Request settlement", state: "complete" },
          { label: "Approval", description: "Approve or reject", state: "complete" },
          { label: "Payment", description: "Record actual settlement", state: "complete" },
          { label: "Reconcile", description: "Post-payment verification", state: "complete" },
        ]} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ManualRule title="Expected is not actual">Expected amounts are planning references. Invoice, approved and paid amounts can legitimately differ.</ManualRule>
          <ManualRule title="History is preserved">Each due item and payment remains a separate record. Do not overwrite history by moving dates or amounts forward.</ManualRule>
          <ManualRule title="Help is contextual">Use the ? control beside a field for 4W1H guidance. Guided Mode controls whether short helper text stays visible under fields.</ManualRule>
        </div>
      </AfendaSection>

      <section id="obligations" className="scroll-mt-6">
        <AfendaSection title="Obligations" description="Use one obligation for the continuing commercial or administrative commitment.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>When to create one</CardTitle><CardDescription>Examples include tenancy, insurance, subscriptions, licences, maintenance, fleet finance, utilities and professional services.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>Create the obligation when the commitment becomes known and its responsible organisation/counterparty can be identified.</p><p>Use the title for a human-readable description; keep external agreement references in the contract/reference fields.</p><p>If the commitment repeats, turn on Recurring and define interval + unit + next due date.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Before activation</CardTitle><CardDescription>The readiness panel mirrors the important server-side activation conditions.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>The counterparty must be active, currency and start date must be present, and required custom fields must be populated.</p><p>If Contract required is on, a contract/document link is mandatory.</p><p>If Recurring is on, interval, unit and next due date are mandatory.</p></CardContent></Card>
          </div>
        </AfendaSection>
      </section>

      <section id="due-items" className="scroll-mt-6">
        <AfendaSection title="Due items & invoices" description="A due item represents one actual occurrence under an obligation.">
          <div className="grid gap-3 md:grid-cols-2">
            <ManualRule title="Generate next">For recurring obligations, Generate next creates the next scheduled occurrence and advances the recurrence pointer without rewriting earlier dues.</ManualRule>
            <ManualRule title="Add manual due">Use manual due for deposits, exceptional charges, one-off invoices or occurrences that must not advance the recurrence schedule.</ManualRule>
            <ManualRule title="Expected amount">The expected amount comes from the obligation or the manual due item and remains useful for comparison.</ManualRule>
            <ManualRule title="Invoice amount">Enter the actual invoiced amount when evidence arrives. Keep invoice number and supporting document URL with the due item.</ManualRule>
            <ManualRule title="Dispute / uncertainty">Use the dispute flag when the amount, liability, evidence or commercial position needs clarification before normal processing.</ManualRule>
            <ManualRule title="Completion">A due item should reflect its own lifecycle; do not change another period's due item to represent a new occurrence.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <section id="payments" className="scroll-mt-6">
        <AfendaSection title="Payments" description="Keep request, approval, settlement and reconciliation as separate facts.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ManualRule title="Requested amount">What the requester proposes to settle against the due item's available balance.</ManualRule>
            <ManualRule title="Approved amount">What the authorised approver permits. It cannot exceed the request or available uncommitted balance.</ManualRule>
            <ManualRule title="Paid amount">What was actually settled, together with date, method, reference and evidence.</ManualRule>
            <ManualRule title="Reconciliation">The final post-payment verification step confirming the recorded settlement has been checked.</ManualRule>
          </div>
          <div className="mt-4 rounded-lg border p-4 text-sm leading-6"><p className="font-medium">Important boundary</p><p className="mt-1 text-muted-foreground">AdministrativePayment is an operational record. It is not a bank ledger, AP invoice, tax posting, journal entry or general-ledger posting.</p></div>
        </AfendaSection>
      </section>

      <section id="counterparties" className="scroll-mt-6">
        <AfendaSection title="Counterparties" description="Maintain the external party once, then link obligations to it.">
          <div className="grid gap-3 md:grid-cols-3">
            <ManualRule title="Use the legal/business party">Record the landlord, vendor, insurer, financier, service provider, authority or other contracting/billing party—not an individual contact as the main identity.</ManualRule>
            <ManualRule title="Defaults are conveniences">Default currency and payment terms help populate new obligations but do not replace the actual terms recorded on each obligation.</ManualRule>
            <ManualRule title="Deactivate instead of deleting">Inactive counterparties remain interpretable in historical obligations while preventing new records from using them accidentally.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <section id="custom-fields" className="scroll-mt-6">
        <AfendaSection title="Custom fields" description="Extend records without creating a development ticket for routine organisation-specific information.">
          <div className="grid gap-3 md:grid-cols-2">
            <ManualRule title="Stable key">Choose a machine-stable key such as policy_number. Treat it like a permanent identifier even if the user-facing label changes later.</ManualRule>
            <ManualRule title="Choose the right type">Use Text, Long text, Number, Date, Boolean, Select, URL, Email or Phone so Afenda can render and validate the correct control.</ManualRule>
            <ManualRule title="Help text matters">Write a short description that tells users what belongs in the field. This becomes the inline helper under the generated control.</ManualRule>
            <ManualRule title="Use Select for controlled values">Provide one clear option per line when users should choose from a governed list instead of typing arbitrary text.</ManualRule>
            <ManualRule title="Required means operationally mandatory">Only mark a custom field required when the record should genuinely be blocked from valid use without it.</ManualRule>
            <ManualRule title="Deactivate instead of deleting">Deactivation keeps historical values understandable while removing the field from new operational entry.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <AfendaSection title="Troubleshooting" description="Start with the visible readiness and workflow state before treating a server response as a technical problem.">
        <div className="grid gap-3 md:grid-cols-2">
          <ManualRule title="Cannot activate">Check required contract evidence, recurrence settings, active counterparty and required custom fields.</ManualRule>
          <ManualRule title="Cannot approve or pay">Check the due item's available balance and the current payment request/approval status. Amount controls prevent over-approval and over-payment.</ManualRule>
          <ManualRule title="Something is overdue">Open the obligation from the attention queue, verify invoice/dispute state, then progress the relevant payment workflow.</ManualRule>
          <ManualRule title="A field is missing">Use Custom fields for organisation-specific structured information. Add a product/schema field only when the concept is common enough to deserve canonical reporting and behavior.</ManualRule>
        </div>
      </AfendaSection>
    </div>
  );
}

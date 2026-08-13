import Link from "next/link";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaSection } from "@/components/afenda/section";
import { AfendaWorkflowStepper } from "@/components/afenda/workflow-stepper";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceUser } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

const chapters = [
  ["sites", "Sites & relationships"],
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
    <AfendaPageFrame width="record">
      <PageHeader
        eyebrow="Corporate Administration"
        title="Help & operating manual"
        description="Practical guidance for modelling sites and counterparties, registering obligations, managing due items and invoices, controlling payments, and extending records safely."
        actions={<Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate" />}>Back to overview</Button>}
      />
      <CorporateNav />

      <nav aria-label="Manual chapters" className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-3">
        {chapters.map(([id, label]) => <Button key={id} size="sm" variant="outline" nativeButton={false} render={<Link href={`#${id}`} />}>{label}</Button>)}
      </nav>

      <AfendaSection title="The operating model" description="Corporate Administration is an operational relationship graph and control register, not the accounting ledger.">
        <AfendaWorkflowStepper steps={[
          { label: "Relationship", description: "Site, party and responsibility", state: "complete" },
          { label: "Obligation", description: "Record terms and evidence", state: "complete" },
          { label: "Due item", description: "Materialise each occurrence", state: "complete" },
          { label: "Approval", description: "Request and approve", state: "complete" },
          { label: "Payment", description: "Record actual settlement", state: "complete" },
          { label: "Reconcile", description: "Post-payment verification", state: "complete" },
        ]} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ManualRule title="Relationships are first-class">A site, provider or contracting party is not a text tag. Use Site, Service Coverage, Obligation Site and Obligation Party relationships so Afenda can report from either direction.</ManualRule>
          <ManualRule title="Expected is not actual">Expected amounts are planning references. Invoice, approved and paid amounts can legitimately differ.</ManualRule>
          <ManualRule title="History is preserved">Each due item and payment remains a separate record. Do not overwrite history by moving dates or amounts forward.</ManualRule>
        </div>
      </AfendaSection>

      <section id="sites" className="scroll-mt-6">
        <AfendaSection title="Sites & relationships" description="Model the operating location once, then connect the parties and obligations that apply there.">
          <div className="grid gap-3 md:grid-cols-2">
            <ManualRule title="Use a Site for a real operating location">Examples include an office, farm, warehouse, central kitchen, retail outlet or leased premises. Keep Site type configurable because operating structures differ between organisations.</ManualRule>
            <ManualRule title="Service Coverage means who serves where">Use Site ↔ Counterparty Service Coverage for cleaning, security, lift maintenance, utilities, pest control and similar provider relationships. Include service category, role and effective dates where useful.</ManualRule>
            <ManualRule title="One provider can serve many sites">Open Counterparty 360 to see every site served and the role held there. Do not duplicate the counterparty just because the service location changes.</ManualRule>
            <ManualRule title="One obligation can cover many sites">Use Obligation Site relationships when a single agreement applies to several locations. Keep the agreement as one obligation unless its terms genuinely need separate lifecycle control.</ManualRule>
            <ManualRule title="One obligation can involve many parties">The primary counterparty remains the compatibility/billing party. Add additional Obligation Party roles such as broker, agent, insurer or service provider when the agreement has more participants.</ManualRule>
            <ManualRule title="Coverage gaps are review signals">The control centre can surface active sites without active service-coverage relationships. Treat this as a prompt to review the site, not as proof that the site is invalid or non-compliant.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <section id="obligations" className="scroll-mt-6">
        <AfendaSection title="Obligations" description="Use one obligation for the continuing commercial or administrative commitment.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>When to create one</CardTitle><CardDescription>Examples include tenancy, insurance, subscriptions, licences, maintenance, fleet finance, utilities and professional services.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground"><p>Create the obligation when the commitment becomes known and its responsible organisation/primary counterparty can be identified.</p><p>Use the Relationship Graph on the record to attach all applicable sites and additional parties instead of encoding them in notes.</p><p>If the commitment repeats, turn on Recurring and define interval + unit + next due date.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Before activation</CardTitle><CardDescription>The readiness panel mirrors the important server-side activation conditions.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground"><p>The primary counterparty must be active, currency and start date must be present, and required custom fields must be populated.</p><p>If Contract required is on, a contract/document link is mandatory.</p><p>If Recurring is on, interval, unit and next due date are mandatory.</p></CardContent></Card>
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
            <ManualRule title="Completion">A due item should reflect its own lifecycle; do not change another period’s due item to represent a new occurrence.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <section id="payments" className="scroll-mt-6">
        <AfendaSection title="Payments" description="Keep request, approval, settlement and reconciliation as separate facts.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ManualRule title="Requested amount">What the requester proposes to settle against the due item’s available balance.</ManualRule>
            <ManualRule title="Approved amount">What the authorised approver permits. It cannot exceed the request or available uncommitted balance.</ManualRule>
            <ManualRule title="Paid amount">What was actually settled, together with date, method, reference and evidence.</ManualRule>
            <ManualRule title="Reconciliation">The final post-payment verification step confirming the recorded settlement has been checked.</ManualRule>
          </div>
          <div className="mt-4 rounded-lg border p-4 text-sm leading-6"><p className="font-medium">Important boundary</p><p className="mt-1 text-muted-foreground">AdministrativePayment is an operational record. It is not a bank ledger, AP invoice, tax posting, journal entry or general-ledger posting.</p></div>
        </AfendaSection>
      </section>

      <section id="counterparties" className="scroll-mt-6">
        <AfendaSection title="Counterparties" description="Maintain the external party once, then reuse it across sites and obligations.">
          <div className="grid gap-3 md:grid-cols-3">
            <ManualRule title="Use the legal/business party">Record the landlord, vendor, insurer, financier, service provider, authority or other contracting/billing party—not an individual contact as the main identity.</ManualRule>
            <ManualRule title="Contacts are a collection">Use named contacts for billing, technical, emergency, account-management or contract roles instead of forcing every purpose into the legacy single contact fields.</ManualRule>
            <ManualRule title="Deactivate instead of deleting">Inactive counterparties remain interpretable in historical obligations and relationships while preventing accidental new use.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <section id="custom-fields" className="scroll-mt-6">
        <AfendaSection title="Custom fields" description="Extend records without turning relationships into unvalidated JSON references.">
          <div className="grid gap-3 md:grid-cols-2">
            <ManualRule title="Scalar metadata belongs here">Use custom fields for organisation-specific facts such as floor area, policy number, permit class or internal reference that do not deserve their own relational entity.</ManualRule>
            <ManualRule title="Relationships do not belong here">Do not store site IDs, provider IDs or obligation IDs inside custom-field JSON. Use the Site, Service Coverage, Obligation Site and Obligation Party relationships instead.</ManualRule>
            <ManualRule title="Stable key">Choose a machine-stable key such as policy_number. Treat it like a permanent identifier even if the user-facing label changes later.</ManualRule>
            <ManualRule title="Choose the right type">Use Text, Long text, Number, Date, Boolean, Select, URL, Email or Phone so Afenda can render and validate the correct control.</ManualRule>
            <ManualRule title="Use Select for controlled values">Provide one clear option per line when users should choose from a governed list instead of typing arbitrary text.</ManualRule>
            <ManualRule title="Deactivate instead of deleting">Deactivation keeps historical values understandable while removing the field from new operational entry.</ManualRule>
          </div>
        </AfendaSection>
      </section>

      <AfendaSection title="Troubleshooting" description="Start with the visible relationship, readiness and workflow state before treating a server response as a technical problem.">
        <div className="grid gap-3 md:grid-cols-2">
          <ManualRule title="A site has no provider">Open Site 360 and review Service Coverage. This is a relationship gap for review; whether coverage is required depends on the site and service.</ManualRule>
          <ManualRule title="Cannot activate">Check required contract evidence, recurrence settings, active primary counterparty and required custom fields.</ManualRule>
          <ManualRule title="Cannot approve or pay">Check the due item’s available balance and the current payment request/approval status. Amount controls prevent over-approval and over-payment.</ManualRule>
          <ManualRule title="A field is missing">Use Custom fields for repeatable scalar metadata. Add a canonical product/schema field or relationship only when the concept needs reporting, referential integrity or behavior.</ManualRule>
        </div>
      </AfendaSection>
    </AfendaPageFrame>
  );
}

import type { AfendaGuidance } from "@/lib/afenda-guidance";

export const CORPORATE_PAGE_GUIDANCE: Record<
  "overview" | "obligations" | "counterparties" | "payments" | "customFields",
  AfendaGuidance
> = {
  overview: {
    summary: "Use this control centre to see what needs attention across Corporate Administration.",
    what: "A read-only operational overview of active obligations, upcoming and overdue due items, pending approvals, and unreconciled payments.",
    why: "It replaces separate tracking spreadsheets and gives users one starting point for administrative follow-up.",
    who: "All authorised workspace users. Administrators can act on records; viewers can monitor the same operational picture.",
    when: "Use it at the start of an administrative review, payment cycle, or follow-up session.",
    how: "Review the attention counts and due list, then open the relevant obligation or payment workflow. The overview derives its status from live data rather than storing another status copy.",
    example: "If Overdue is 3, open the obligations register and review the three open due items whose due dates have passed.",
  },
  obligations: {
    summary: "The obligations register is the source of truth for recurring and one-off administrative commitments.",
    what: "A register of tenancy, insurance, subscriptions, fleet, licences, maintenance, professional services, and other administrative commitments.",
    why: "Keeping terms, evidence, due items, and payment history together makes each commitment understandable without separate spreadsheets.",
    who: "Administrators create and maintain records; viewers can review the register and record details.",
    when: "Create an obligation when a commitment is known. Return to the register when terms, schedules, evidence, or payment activity need review.",
    how: "Create the counterparty first, create the obligation as a draft, complete the terms and evidence, activate it, then generate or add due items as the commitment becomes payable.",
    example: "Office tenancy → active obligation → monthly due item → payment request → approval → payment → reconciliation.",
  },
  counterparties: {
    summary: "Maintain the external parties connected to administrative commitments.",
    what: "A reusable party register for vendors, landlords, insurers, financiers, service providers, authorities, and other counterparties.",
    why: "It prevents duplicate party details and lets obligations reuse the same name, contact details, default currency, and payment terms.",
    who: "Administrators maintain counterparties; viewers can read the party register.",
    when: "Create a party before the first obligation that refers to it. Update the party when its legal, contact, or normal commercial information changes.",
    how: "Use the legal or recognised business identity, keep broad classification simple, and add custom fields only for structured information that is repeatedly useful.",
    example: "Create ABC Properties Sdn Bhd once, then link every related tenancy or maintenance obligation to that counterparty.",
  },
  payments: {
    summary: "Use the payment workspace to move approved administrative obligations from request to reconciliation.",
    what: "The operational payment queue for requests, approvals, recorded settlements, and reconciliation status tied to due items.",
    why: "It separates expected, invoiced, requested, approved, paid, and reconciled amounts so each decision remains auditable.",
    who: "Administrators request, approve, record, and reconcile payments according to their internal process. Viewers can inspect status and history.",
    when: "Use it after a due item exists and money needs to be requested, approved, recorded as paid, or reconciled.",
    how: "Open the relevant due item, request an amount, approve or reject it, record the actual settlement, then reconcile it once the payment is verified.",
    example: "Invoice RM15,180 → request RM15,180 → approve RM15,000 → record RM15,000 paid → reconcile after bank verification.",
  },
  customFields: {
    summary: "Add governed fields when Corporate Administration needs structured information that the core schema does not provide.",
    what: "An administrator-managed definition library for extra fields on counterparties, obligations, due items, and payments.",
    why: "It lets the MVP adapt to real operational requirements without a development ticket for every missing field.",
    who: "Administrators define and maintain custom fields. All authorised users see active fields on the relevant records.",
    when: "Create a custom field when the information is repeatedly useful, should be validated by type, or needs to appear consistently across records.",
    how: "Choose the record scope, stable key, label, data type, required state, help text, list visibility, and Select options where applicable. Deactivate obsolete fields instead of deleting historical meaning.",
    example: "Add Insurance policy number as a required Text field on obligations, with a short help description and example value.",
  },
};

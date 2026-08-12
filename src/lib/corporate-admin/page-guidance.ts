import type { AfendaGuidance } from "@/lib/afenda-guidance";

export const CORPORATE_PAGE_GUIDANCE: Record<
  "overview" | "sites" | "obligations" | "counterparties" | "payments" | "customFields",
  AfendaGuidance
> = {
  overview: {
    summary: "Use this control centre to see what needs attention across Corporate Administration.",
    what: "A read-only operational overview of active sites and obligations, upcoming and overdue due items, pending approvals, unreconciled payments, and relationship coverage gaps.",
    why: "It replaces separate tracking spreadsheets and gives users one starting point for administrative follow-up across both records and their operating relationships.",
    who: "All authorised workspace users. Administrators can act on records; viewers can monitor the same operational picture.",
    when: "Use it at the start of an administrative review, payment cycle, site review, or follow-up session.",
    how: "Review attention counts and relationship gaps, then move into the relevant Site, Counterparty, Obligation, or Payment workspace. Status is derived from live data rather than stored in another spreadsheet-like copy.",
    example: "If a site has no active service coverage, open Site 360 to decide whether that is intentional or a missing provider relationship.",
  },
  sites: {
    summary: "Sites are the operating locations where counterparties, obligations, services and administrative risk meet.",
    what: "A first-class location register for offices, farms, kitchens, stores, warehouses, factories, land and project sites, with many service providers and many obligations per site.",
    why: "A location should not be repeated as free text across contracts and spreadsheets. Site 360 gives users one place to see who serves a location, which obligations affect it and what is due there.",
    who: "Administrators create sites and manage relationships; all authorised users use Site 360 to understand location context.",
    when: "Create a site once the organisation operates, owns, occupies or administratively manages a meaningful location. Link providers and obligations whenever their scope includes that location.",
    how: "Keep stable location facts on the Site record. Use Service coverage for Site↔Counterparty relationships and Obligation links for Site↔Obligation relationships. Use Site custom fields only for metadata—not foreign-key relationships.",
    example: "Klang HQ → cleaning by CleanPro, lift maintenance by Otis, landlord Meridian Properties → tenancy and maintenance obligations → due items and evidence visible from the same Site 360 workspace.",
  },
  obligations: {
    summary: "The obligations register is the source of truth for recurring and one-off administrative commitments.",
    what: "A register of tenancy, insurance, subscriptions, fleet, licences, maintenance, professional services, and other administrative commitments, including the sites and counterparties involved.",
    why: "Keeping terms, relationships, evidence, due items, and payment history together makes each commitment understandable without separate spreadsheets.",
    who: "Administrators create and maintain records and relationships; viewers can review the register and record details.",
    when: "Create an obligation when a commitment is known. Link all relevant sites and parties as its operating scope becomes clear.",
    how: "Keep the legacy primary counterparty for backward-compatible workflow behavior, then use the Relationship graph to link additional sites and counterparty roles. Activate only after core terms and evidence are ready.",
    example: "Multi-site cleaning contract → primary service provider → three linked sites → monthly due → approval → payment → reconciliation.",
  },
  counterparties: {
    summary: "Maintain external parties as reusable operating relationships, not isolated vendor rows.",
    what: "A reusable party register for vendors, landlords, insurers, financiers, service providers, authorities, and other counterparties, with named contacts, sites served and obligation roles.",
    why: "Counterparty 360 prevents duplicate party data and makes its complete operating footprint visible across sites and commitments.",
    who: "Administrators maintain counterparties, contacts and relationships; viewers can inspect the same 360-degree context.",
    when: "Create a party before its first service coverage or obligation relationship. Add distinct billing, technical and emergency contacts instead of overwriting one generic contact.",
    how: "Keep legal/business identity on the counterparty; manage people in Contacts; link site services through Service coverage; link contract roles through Obligation parties.",
    example: "CleanPro Sdn Bhd → billing contact + emergency supervisor → cleaning coverage at Klang HQ and Central Kitchen → service-contract role on two obligations.",
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
    summary: "Add governed metadata when Corporate Administration needs structured information that the core schema does not provide.",
    what: "An administrator-managed definition library for extra metadata fields on counterparties, sites, obligations, due items, and payments.",
    why: "It lets the module adapt to real operational requirements without a development ticket for every missing scalar field, while preserving relational integrity for actual relationships.",
    who: "Administrators define and maintain custom fields. All authorised users see active fields on the relevant records.",
    when: "Create a custom field when information is repeatedly useful and scalar in nature. Do not use a custom field when the concept is a Site, Counterparty, Obligation, person, or another relationship that should be navigable and referentially valid.",
    how: "Choose the record scope, stable key, label, data type, required state, help text, list visibility, and Select options where applicable. Deactivate obsolete fields instead of deleting historical meaning.",
    example: "Add floor_area_sq_m as a Number field on Sites; link the cleaning provider through Service coverage instead of storing a provider ID in JSON.",
  },
};

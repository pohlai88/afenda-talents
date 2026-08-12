"use client";

import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateCheckField, CorporateField } from "@/components/corporate/form-primitives";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COUNTERPARTY_TYPE_SUGGESTIONS } from "@/lib/corporate-admin/domain";
import { COUNTERPARTY_GUIDANCE } from "@/lib/corporate-admin/guidance";

export type CounterpartyDraft = {
  code: string; name: string; type: string; registrationNo: string; taxId: string; contactName: string;
  contactEmail: string; contactPhone: string; address: string; countryCode: string; websiteUrl: string;
  defaultCurrency: string; paymentTermsDays: string; isActive: boolean; notes: string; customFields: Record<string, unknown>;
};

export const EMPTY_COUNTERPARTY: CounterpartyDraft = {
  code: "", name: "", type: "VENDOR", registrationNo: "", taxId: "", contactName: "", contactEmail: "", contactPhone: "",
  address: "", countryCode: "MY", websiteUrl: "", defaultCurrency: "MYR", paymentTermsDays: "", isActive: true, notes: "", customFields: {},
};

export function CounterpartyFormFields({ draft, set, definitions }: {
  draft: CounterpartyDraft;
  set: <K extends keyof CounterpartyDraft>(key: K, value: CounterpartyDraft[K]) => void;
  definitions: CorporateCustomFieldDefinitionDto[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CorporateField label="Reference code" id="cp-code" guidance={COUNTERPARTY_GUIDANCE.code}>
        <Input id="cp-code" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="Auto-generated if blank" />
      </CorporateField>
      <CorporateField label="Name" id="cp-name" required guidance={COUNTERPARTY_GUIDANCE.name}>
        <Input id="cp-name" value={draft.name} onChange={(e) => set("name", e.target.value)} required />
      </CorporateField>
      <CorporateField label="Type" id="cp-type" required guidance={COUNTERPARTY_GUIDANCE.type}>
        <Input id="cp-type" list="counterparty-type-options" value={draft.type} onChange={(e) => set("type", e.target.value)} required />
        <datalist id="counterparty-type-options">{COUNTERPARTY_TYPE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
      </CorporateField>
      <CorporateField label="Registration number" id="cp-reg" guidance={COUNTERPARTY_GUIDANCE.registrationNo}>
        <Input id="cp-reg" value={draft.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} />
      </CorporateField>
      <CorporateField label="Tax ID" id="cp-tax" guidance={COUNTERPARTY_GUIDANCE.taxId}>
        <Input id="cp-tax" value={draft.taxId} onChange={(e) => set("taxId", e.target.value)} />
      </CorporateField>
      <CorporateField label="Contact name" id="cp-contact" description="Primary operational contact for this party.">
        <Input id="cp-contact" value={draft.contactName} onChange={(e) => set("contactName", e.target.value)} />
      </CorporateField>
      <CorporateField label="Contact email" id="cp-email" description="Email normally used for operational correspondence.">
        <Input id="cp-email" type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
      </CorporateField>
      <CorporateField label="Contact phone" id="cp-phone" description="Phone number normally used for operational follow-up.">
        <Input id="cp-phone" type="tel" value={draft.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
      </CorporateField>
      <CorporateField label="Country code" id="cp-country" description="Two-letter country code for the party's primary legal or business location.">
        <Input id="cp-country" maxLength={2} value={draft.countryCode} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} />
      </CorporateField>
      <CorporateField label="Default currency" id="cp-currency" guidance={COUNTERPARTY_GUIDANCE.defaultCurrency}>
        <Input id="cp-currency" maxLength={3} value={draft.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value.toUpperCase())} />
      </CorporateField>
      <CorporateField label="Payment terms (days)" id="cp-terms" guidance={COUNTERPARTY_GUIDANCE.paymentTermsDays}>
        <Input id="cp-terms" type="number" min="0" value={draft.paymentTermsDays} onChange={(e) => set("paymentTermsDays", e.target.value)} />
      </CorporateField>
      <CorporateField label="Website" id="cp-web" description="Official or operational website when it is useful for reference.">
        <Input id="cp-web" type="url" value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} />
      </CorporateField>
      <CorporateField label="Address" id="cp-address" className="sm:col-span-2" description="Primary business or correspondence address used for this relationship.">
        <Textarea id="cp-address" value={draft.address} onChange={(e) => set("address", e.target.value)} />
      </CorporateField>
      <CorporateField label="Notes" id="cp-notes" className="sm:col-span-2" description="Use for concise operational context that does not need a structured custom field.">
        <Textarea id="cp-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
      </CorporateField>
      <CorporateCheckField label="Active counterparty" checked={draft.isActive} onChange={(value) => set("isActive", value)} guidance={COUNTERPARTY_GUIDANCE.isActive} />
      <div className="sm:col-span-2"><CustomFieldControls definitions={definitions} values={draft.customFields} onChange={(values) => set("customFields", values)} /></div>
    </div>
  );
}

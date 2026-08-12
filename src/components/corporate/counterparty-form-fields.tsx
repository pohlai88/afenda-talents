"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { CorporateField } from "@/components/corporate/form-primitives";
import { COUNTERPARTY_TYPE_SUGGESTIONS } from "@/lib/corporate-admin/domain";

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
      <CorporateField label="Reference code" id="cp-code"><Input id="cp-code" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="Auto-generated if blank" /></CorporateField>
      <CorporateField label="Name *" id="cp-name"><Input id="cp-name" value={draft.name} onChange={(e) => set("name", e.target.value)} required /></CorporateField>
      <CorporateField label="Type *" id="cp-type"><Input id="cp-type" list="counterparty-type-options" value={draft.type} onChange={(e) => set("type", e.target.value)} required /><datalist id="counterparty-type-options">{COUNTERPARTY_TYPE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist></CorporateField>
      <CorporateField label="Registration number" id="cp-reg"><Input id="cp-reg" value={draft.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} /></CorporateField>
      <CorporateField label="Tax ID" id="cp-tax"><Input id="cp-tax" value={draft.taxId} onChange={(e) => set("taxId", e.target.value)} /></CorporateField>
      <CorporateField label="Contact name" id="cp-contact"><Input id="cp-contact" value={draft.contactName} onChange={(e) => set("contactName", e.target.value)} /></CorporateField>
      <CorporateField label="Contact email" id="cp-email"><Input id="cp-email" type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></CorporateField>
      <CorporateField label="Contact phone" id="cp-phone"><Input id="cp-phone" type="tel" value={draft.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></CorporateField>
      <CorporateField label="Country code" id="cp-country"><Input id="cp-country" maxLength={2} value={draft.countryCode} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} /></CorporateField>
      <CorporateField label="Default currency" id="cp-currency"><Input id="cp-currency" maxLength={3} value={draft.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value.toUpperCase())} /></CorporateField>
      <CorporateField label="Payment terms (days)" id="cp-terms"><Input id="cp-terms" type="number" min="0" value={draft.paymentTermsDays} onChange={(e) => set("paymentTermsDays", e.target.value)} /></CorporateField>
      <CorporateField label="Website" id="cp-web"><Input id="cp-web" type="url" value={draft.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} /></CorporateField>
      <CorporateField label="Address" id="cp-address" className="sm:col-span-2"><Textarea id="cp-address" value={draft.address} onChange={(e) => set("address", e.target.value)} /></CorporateField>
      <CorporateField label="Notes" id="cp-notes" className="sm:col-span-2"><Textarea id="cp-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} /></CorporateField>
      <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"><Checkbox checked={draft.isActive} onCheckedChange={(value) => set("isActive", value === true)} /><span>Active counterparty</span></label>
      <div className="sm:col-span-2"><CustomFieldControls definitions={definitions} values={draft.customFields} onChange={(values) => set("customFields", values)} /></div>
    </div>
  );
}

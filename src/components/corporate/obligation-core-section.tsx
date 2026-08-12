"use client";

import { CorporateField } from "@/components/corporate/form-primitives";
import type { CorporateOption, ObligationDraft } from "@/components/corporate/obligation-form-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OBLIGATION_CATEGORY_SUGGESTIONS, PAYMENT_METHOD_SUGGESTIONS } from "@/lib/corporate-admin/domain";
import { OBLIGATION_GUIDANCE } from "@/lib/corporate-admin/guidance";

export function ObligationCoreSection({ draft, set, counterparties, users }: {
  draft: ObligationDraft;
  set: <K extends keyof ObligationDraft>(key: K, value: ObligationDraft[K]) => void;
  counterparties: CorporateOption[];
  users: CorporateOption[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Core record</CardTitle>
        <CardDescription>Identify who owns the obligation, what it governs, and the external party involved.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <CorporateField label="Reference code" id="ob-code" guidance={OBLIGATION_GUIDANCE.code}>
          <Input id="ob-code" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="Auto-generated if blank" />
        </CorporateField>
        <CorporateField label="Organisation" id="ob-org" required guidance={OBLIGATION_GUIDANCE.organization}>
          <Input id="ob-org" value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="e.g. DLBB" required />
        </CorporateField>
        <CorporateField label="Category" id="ob-category" required guidance={OBLIGATION_GUIDANCE.category}>
          <Input id="ob-category" list="obligation-category-options" value={draft.category} onChange={(e) => set("category", e.target.value)} required />
          <datalist id="obligation-category-options">{OBLIGATION_CATEGORY_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
        </CorporateField>
        <CorporateField label="Title" id="ob-title" required guidance={OBLIGATION_GUIDANCE.title}>
          <Input id="ob-title" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Office tenancy — Klang" required />
        </CorporateField>
        <CorporateField label="Counterparty" id="ob-counterparty" required guidance={OBLIGATION_GUIDANCE.counterparty}>
          <Select value={draft.counterpartyId} onValueChange={(value) => { set("counterpartyId", value); const match = counterparties.find((item) => item.id === value); if (match?.currency && draft.currency === "") set("currency", match.currency); }}>
            <SelectTrigger id="ob-counterparty" className="w-full"><SelectValue placeholder="Choose counterparty" /></SelectTrigger>
            <SelectContent><SelectGroup>{counterparties.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </CorporateField>
        <CorporateField label="Owner" id="ob-owner" guidance={OBLIGATION_GUIDANCE.owner}>
          <Select value={draft.ownerId} onValueChange={(value) => set("ownerId", value)}>
            <SelectTrigger id="ob-owner" className="w-full"><SelectValue placeholder="Current user if blank" /></SelectTrigger>
            <SelectContent><SelectGroup>{users.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </CorporateField>
        <CorporateField label="Asset / location reference" id="ob-asset" guidance={OBLIGATION_GUIDANCE.assetReference}>
          <Input id="ob-asset" value={draft.assetReference} onChange={(e) => set("assetReference", e.target.value)} placeholder="Premise, vehicle, account or asset reference" />
        </CorporateField>
        <CorporateField label="Default payment method" id="ob-method" guidance={OBLIGATION_GUIDANCE.paymentMethod}>
          <Input id="ob-method" list="payment-method-options" value={draft.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} />
          <datalist id="payment-method-options">{PAYMENT_METHOD_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
        </CorporateField>
      </CardContent>
    </Card>
  );
}

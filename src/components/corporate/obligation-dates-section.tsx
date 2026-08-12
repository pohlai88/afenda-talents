"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CorporateCheckField, CorporateField } from "@/components/corporate/form-primitives";
import type { ObligationDraft } from "@/components/corporate/obligation-form-types";

export function ObligationDatesSection({ draft, set }: {
  draft: ObligationDraft;
  set: <K extends keyof ObligationDraft>(key: K, value: ObligationDraft[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dates & schedule</CardTitle>
        <CardDescription>Use explicit dates and an interval plus unit for repeating obligations.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CorporateField label="Start date *" id="ob-start"><Input id="ob-start" type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} required /></CorporateField>
        <CorporateField label="End date" id="ob-end"><Input id="ob-end" type="date" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} /></CorporateField>
        <CorporateField label="Expected amount" id="ob-amount"><Input id="ob-amount" type="number" min="0" step="0.01" value={draft.expectedAmount} onChange={(e) => set("expectedAmount", e.target.value)} /></CorporateField>
        <CorporateField label="Currency *" id="ob-currency"><Input id="ob-currency" maxLength={3} value={draft.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} required /></CorporateField>
        <CorporateField label="First due date" id="ob-first-due"><Input id="ob-first-due" type="date" value={draft.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} /></CorporateField>
        <CorporateField label="Next due date" id="ob-next-due"><Input id="ob-next-due" type="date" value={draft.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} /></CorporateField>
        <CorporateCheckField label="Recurring" checked={draft.recurring} onChange={(value) => set("recurring", value)} />
        {draft.recurring ? (
          <>
            <CorporateField label="Repeat every" id="ob-interval"><Input id="ob-interval" type="number" min="1" value={draft.recurrenceInterval} onChange={(e) => set("recurrenceInterval", e.target.value)} required /></CorporateField>
            <CorporateField label="Unit" id="ob-unit">
              <select id="ob-unit" className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm" value={draft.recurrenceUnit} onChange={(e) => set("recurrenceUnit", e.target.value as ObligationDraft["recurrenceUnit"])}>
                <option value="DAY">day</option><option value="WEEK">week</option><option value="MONTH">month</option><option value="YEAR">year</option>
              </select>
            </CorporateField>
          </>
        ) : null}
        <CorporateCheckField label="Auto-renew" checked={draft.autoRenew} onChange={(value) => set("autoRenew", value)} />
        <CorporateField label="Renewal date" id="ob-renewal"><Input id="ob-renewal" type="date" value={draft.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} /></CorporateField>
        <CorporateField label="Notice days" id="ob-notice"><Input id="ob-notice" type="number" min="0" value={draft.noticeDays} onChange={(e) => set("noticeDays", e.target.value)} /></CorporateField>
      </CardContent>
    </Card>
  );
}

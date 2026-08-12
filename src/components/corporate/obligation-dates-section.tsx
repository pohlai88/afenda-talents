"use client";

import { CorporateCheckField, CorporateField } from "@/components/corporate/form-primitives";
import type { ObligationDraft } from "@/components/corporate/obligation-form-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OBLIGATION_GUIDANCE } from "@/lib/corporate-admin/guidance";

const RECURRENCE_UNITS: Array<{ value: ObligationDraft["recurrenceUnit"]; label: string }> = [
  { value: "DAY", label: "Day" },
  { value: "WEEK", label: "Week" },
  { value: "MONTH", label: "Month" },
  { value: "YEAR", label: "Year" },
];

export function ObligationDatesSection({ draft, set }: {
  draft: ObligationDraft;
  set: <K extends keyof ObligationDraft>(key: K, value: ObligationDraft[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dates & schedule</CardTitle>
        <CardDescription>Define when the obligation starts, what is expected, and how repeating occurrences should be generated.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CorporateField label="Start date" id="ob-start" required guidance={OBLIGATION_GUIDANCE.startDate}>
          <Input id="ob-start" type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} required />
        </CorporateField>
        <CorporateField label="End date" id="ob-end" guidance={OBLIGATION_GUIDANCE.endDate}>
          <Input id="ob-end" type="date" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </CorporateField>
        <CorporateField label="Expected amount" id="ob-amount" guidance={OBLIGATION_GUIDANCE.expectedAmount}>
          <Input id="ob-amount" type="number" min="0" step="0.01" value={draft.expectedAmount} onChange={(e) => set("expectedAmount", e.target.value)} />
        </CorporateField>
        <CorporateField label="Currency" id="ob-currency" required guidance={OBLIGATION_GUIDANCE.currency}>
          <Input id="ob-currency" maxLength={3} value={draft.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} required />
        </CorporateField>
        <CorporateField label="First due date" id="ob-first-due" guidance={OBLIGATION_GUIDANCE.firstDueDate}>
          <Input id="ob-first-due" type="date" value={draft.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} />
        </CorporateField>
        <CorporateField label="Next due date" id="ob-next-due" guidance={OBLIGATION_GUIDANCE.nextDueDate}>
          <Input id="ob-next-due" type="date" value={draft.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
        </CorporateField>
        <CorporateCheckField label="Recurring" checked={draft.recurring} onChange={(value) => set("recurring", value)} guidance={OBLIGATION_GUIDANCE.recurring} />
        {draft.recurring ? (
          <>
            <CorporateField label="Repeat every" id="ob-interval" required guidance={OBLIGATION_GUIDANCE.recurrenceInterval}>
              <Input id="ob-interval" type="number" min="1" value={draft.recurrenceInterval} onChange={(e) => set("recurrenceInterval", e.target.value)} required />
            </CorporateField>
            <CorporateField label="Unit" id="ob-unit" required guidance={OBLIGATION_GUIDANCE.recurrenceUnit}>
              <Select value={draft.recurrenceUnit} onValueChange={(value) => set("recurrenceUnit", value as ObligationDraft["recurrenceUnit"])}>
                <SelectTrigger id="ob-unit" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {RECURRENCE_UNITS.map((unit) => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </CorporateField>
          </>
        ) : null}
        <CorporateCheckField label="Auto-renew" checked={draft.autoRenew} onChange={(value) => set("autoRenew", value)} guidance={OBLIGATION_GUIDANCE.autoRenew} />
        <CorporateField label="Renewal date" id="ob-renewal" guidance={OBLIGATION_GUIDANCE.renewalDate}>
          <Input id="ob-renewal" type="date" value={draft.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} />
        </CorporateField>
        <CorporateField label="Notice days" id="ob-notice" guidance={OBLIGATION_GUIDANCE.noticeDays}>
          <Input id="ob-notice" type="number" min="0" value={draft.noticeDays} onChange={(e) => set("noticeDays", e.target.value)} />
        </CorporateField>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomFieldControls, type CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";
import { ObligationCoreSection } from "@/components/corporate/obligation-core-section";
import { ObligationDatesSection } from "@/components/corporate/obligation-dates-section";
import { ObligationEvidenceSection } from "@/components/corporate/obligation-evidence-section";
import { EMPTY_OBLIGATION_DRAFT, type CorporateOption, type ObligationDraft } from "@/components/corporate/obligation-form-types";

export function ObligationForm({ counterparties, users, customFields, initial, obligationId }: {
  counterparties: CorporateOption[];
  users: CorporateOption[];
  customFields: CorporateCustomFieldDefinitionDto[];
  initial?: Partial<ObligationDraft>;
  obligationId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ObligationDraft>({ ...EMPTY_OBLIGATION_DRAFT, ...initial, customFields: initial?.customFields ?? {} });
  const set = <K extends keyof ObligationDraft>(key: K, value: ObligationDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const payload = {
      ...draft,
      code: draft.code || null,
      ownerId: draft.ownerId || null,
      endDate: draft.endDate || null,
      recurrenceInterval: draft.recurring ? Number(draft.recurrenceInterval) : null,
      recurrenceUnit: draft.recurring ? draft.recurrenceUnit : null,
      expectedAmount: draft.expectedAmount === "" ? null : Number(draft.expectedAmount),
      firstDueDate: draft.firstDueDate || null,
      nextDueDate: draft.nextDueDate || null,
      renewalDate: draft.renewalDate || null,
      noticeDays: draft.noticeDays === "" ? null : Number(draft.noticeDays),
    };
    try {
      const response = await fetch(obligationId ? `/api/admin/corporate/obligations/${obligationId}` : "/api/admin/corporate/obligations", {
        method: obligationId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not save obligation");
      toast.success(obligationId ? "Obligation updated." : "Obligation created.");
      if (obligationId) router.refresh();
      else router.push(`/admin/corporate/obligations/${body.obligation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save obligation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <ObligationCoreSection draft={draft} set={set} counterparties={counterparties} users={users} />
      <ObligationDatesSection draft={draft} set={set} />
      <ObligationEvidenceSection draft={draft} set={set} />
      <CustomFieldControls definitions={customFields} values={draft.customFields} onChange={(values) => set("customFields", values)} />
      <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="submit" disabled={busy || !draft.counterpartyId}>{busy ? "Saving…" : obligationId ? "Save changes" : "Create obligation"}</Button>
      </div>
    </form>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CorporateCheckField, CorporateField } from "@/components/corporate/form-primitives";
import type { ObligationDraft } from "@/components/corporate/obligation-form-types";

export function ObligationEvidenceSection({ draft, set }: {
  draft: ObligationDraft;
  set: <K extends keyof ObligationDraft>(key: K, value: ObligationDraft[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract & evidence</CardTitle>
        <CardDescription>Link the source agreement and keep operational notes with the obligation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <CorporateCheckField label="Contract required before activation" checked={draft.contractRequired} onChange={(value) => set("contractRequired", value)} />
        <CorporateField label="Contract reference" id="ob-contract-ref"><Input id="ob-contract-ref" value={draft.contractReference} onChange={(e) => set("contractReference", e.target.value)} /></CorporateField>
        <CorporateField label="Contract file / document URL" id="ob-contract-url" className="sm:col-span-2"><Input id="ob-contract-url" type="url" value={draft.contractFileUrl} onChange={(e) => set("contractFileUrl", e.target.value)} placeholder="https://…" /></CorporateField>
        <CorporateField label="Notes" id="ob-notes" className="sm:col-span-2"><Textarea id="ob-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Operational context, exceptions or follow-up notes" /></CorporateField>
      </CardContent>
    </Card>
  );
}

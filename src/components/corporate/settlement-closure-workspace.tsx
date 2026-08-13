"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaField } from "@/components/afenda/form-layout";
import { AfendaMetadataGrid } from "@/components/afenda/metadata-grid";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { CorporateStatusBadge, formatMoney, todayDateOnly } from "@/components/corporate/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reconciliationCategories, reconciliationDirections, reconciliationStatuses, terminationTypes } from "@/lib/corporate-admin/settlement";

type ClosureDto = {
  id: string;
  status: "OPEN" | "RECONCILING" | "READY" | "CLOSED";
  terminationType: "EXPIRED" | "TERMINATED" | "CANCELLED" | "SURRENDERED" | "OTHER" | null;
  noticeDate: string | null;
  effectiveDate: string | null;
  handoverDate: string | null;
  terminationReason: string | null;
  terminationDocumentUrl: string | null;
  notes: string | null;
  closedAt: string | null;
};

type ReconciliationItemDto = {
  id: string;
  category: string;
  direction: "PAYABLE" | "RECEIVABLE";
  description: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  currency: string;
  status: "OPEN" | "SETTLED" | "WAIVED" | "DISPUTED";
  evidenceUrl: string | null;
  notes: string | null;
};

export function SettlementClosureWorkspace({
  obligation,
  closure,
  items,
  blockers,
  counts,
  isAdmin,
}: {
  obligation: { id: string; code: string; title: string; status: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED"; currency: string };
  closure: ClosureDto | null;
  items: ReconciliationItemDto[];
  blockers: string[];
  counts: { openDueItems: number; pendingApprovals: number; unreconciledPayments: number; unresolvedReconciliationItems: number };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [terminationOpen, setTerminationOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<ReconciliationItemDto | null>(null);

  const [terminationType, setTerminationType] = useState<string>(closure?.terminationType ?? "TERMINATED");
  const [noticeDate, setNoticeDate] = useState(closure?.noticeDate ?? "");
  const [effectiveDate, setEffectiveDate] = useState(closure?.effectiveDate ?? todayDateOnly());
  const [handoverDate, setHandoverDate] = useState(closure?.handoverDate ?? "");
  const [terminationReason, setTerminationReason] = useState(closure?.terminationReason ?? "");
  const [terminationDocumentUrl, setTerminationDocumentUrl] = useState(closure?.terminationDocumentUrl ?? "");
  const [terminationNotes, setTerminationNotes] = useState(closure?.notes ?? "");

  const [category, setCategory] = useState("DEPOSIT");
  const [direction, setDirection] = useState("RECEIVABLE");
  const [description, setDescription] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [currency, setCurrency] = useState(obligation.currency);
  const [itemStatus, setItemStatus] = useState("OPEN");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  const payable = items.filter((item) => item.direction === "PAYABLE" && item.status !== "WAIVED").reduce((sum, item) => sum + (item.actualAmount ?? item.expectedAmount ?? 0), 0);
  const receivable = items.filter((item) => item.direction === "RECEIVABLE" && item.status !== "WAIVED").reduce((sum, item) => sum + (item.actualAmount ?? item.expectedAmount ?? 0), 0);
  const net = payable - receivable;

  async function call(url: string, method: "POST" | "PUT" | "PATCH", body: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(data.blockers) ? ` ${data.blockers.join("; ")}` : "";
        throw new Error(`${typeof data.error === "string" ? data.error : "Operation failed"}${detail}`);
      }
      toast.success(success);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openNewItem() {
    setCategory("DEPOSIT"); setDirection("RECEIVABLE"); setDescription(""); setExpectedAmount(""); setActualAmount(""); setCurrency(obligation.currency); setItemStatus("OPEN"); setEvidenceUrl(""); setItemNotes(""); setItemOpen(true);
  }

  function openEditItem(item: ReconciliationItemDto) {
    setEditing(item); setActualAmount(item.actualAmount == null ? "" : String(item.actualAmount)); setItemStatus(item.status); setEvidenceUrl(item.evidenceUrl ?? ""); setItemNotes(item.notes ?? "");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardDescription>Contract lifecycle</CardDescription><CardTitle><CorporateStatusBadge status={obligation.status} /></CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Termination stops the agreement lifecycle. It does not mean the administrative file is fully reconciled.</CardContent></Card>
        <Card><CardHeader><CardDescription>File closure</CardDescription><CardTitle><CorporateStatusBadge status={closure?.status ?? "NOT_STARTED"} /></CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{closure?.closedAt ? `Closed ${closure.closedAt.slice(0, 10)}` : closure ? "Settlement review in progress." : "Termination/closure has not been started."}</CardContent></Card>
        <Card><CardHeader><CardDescription>Settlement position</CardDescription><CardTitle className="tabular-nums">{formatMoney(obligation.currency, Math.abs(net))}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{net > 0 ? "Net payable" : net < 0 ? "Net receivable" : "Balanced from reconciliation items"}</CardContent></Card>
        <Card><CardHeader><CardDescription>Closure blockers</CardDescription><CardTitle className="tabular-nums">{blockers.length}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Open due, approvals, unreconciled payments and unresolved settlement items are all gating controls.</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>Termination record</CardTitle><CardDescription>Record why and when the agreement ended. Starting this process ends future scheduling while preserving the file for settlement and audit.</CardDescription></div>
          {isAdmin && closure?.status !== "CLOSED" && obligation.status !== "DRAFT" ? <Button onClick={() => setTerminationOpen(true)}>{closure ? "Edit termination" : "Start termination"}</Button> : null}
        </CardHeader>
        <CardContent>
          {closure ? <AfendaMetadataGrid columns={3} items={[
            { label: "Type", value: closure.terminationType?.replaceAll("_", " ") ?? "—" },
            { label: "Notice date", value: closure.noticeDate ?? "—" },
            { label: "Effective date", value: closure.effectiveDate ?? "—" },
            { label: "Handover date", value: closure.handoverDate ?? "—" },
            { label: "Reason", value: closure.terminationReason ?? "—" },
            { label: "Evidence", value: closure.terminationDocumentUrl ?? "—" },
          ]} /> : <AfendaEmptyState compact title="Termination not recorded" description="Start termination before final settlement and file closure can be completed." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>Final reconciliation</CardTitle><CardDescription>Capture deposit, rental, cleaning, utilities, repairs, service charges, credits/refunds and other final settlement items. Direction tells Afenda whether the organization owes or should receive the amount.</CardDescription></div>
          {isAdmin && closure && closure.status !== "CLOSED" ? <Button variant="outline" onClick={openNewItem}>Add reconciliation item</Button> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {items.length === 0 ? <AfendaEmptyState compact title="No final settlement items" description={closure ? "Add only the items needed to explain the final position. Ordinary recurring charges should remain due items." : "Start termination first."} /> : items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.description}</span><CorporateStatusBadge status={item.category} /><CorporateStatusBadge status={item.direction} /><CorporateStatusBadge status={item.status} /></div><p className="mt-1 text-xs text-muted-foreground">Expected {formatMoney(item.currency, item.expectedAmount)} · Actual {formatMoney(item.currency, item.actualAmount)}</p></div>
                {isAdmin && closure?.status !== "CLOSED" ? <Button size="sm" variant="outline" onClick={() => openEditItem(item)}>Update</Button> : null}
              </div>
              {item.evidenceUrl || item.notes ? <p className="mt-2 text-xs text-muted-foreground">{item.notes || item.evidenceUrl}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Close-file gate</CardTitle><CardDescription>The file can close only after the operating balance and exit settlement are fully resolved.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AfendaMetadataGrid columns={4} items={[
            { label: "Open due items", value: String(counts.openDueItems) },
            { label: "Pending approvals", value: String(counts.pendingApprovals) },
            { label: "Unreconciled payments", value: String(counts.unreconciledPayments) },
            { label: "Unresolved settlement", value: String(counts.unresolvedReconciliationItems) },
          ]} />
          {blockers.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p className="text-sm">All closure controls are clear. The file is ready for final closure.</p>}
          {isAdmin && closure?.status !== "CLOSED" ? <div><AfendaConfirmButton busy={busy} disabled={blockers.length > 0} title="Close this administrative file?" description="Closing freezes the settlement workflow as complete. Payment, reconciliation and audit history remain available for reference." confirmLabel="Close file" onConfirm={() => call(`/api/admin/corporate/obligations/${obligation.id}/closure`, "PATCH", { action: "CLOSE_FILE" }, "Administrative file closed.")}>Close file</AfendaConfirmButton></div> : null}
        </CardContent>
      </Card>

      <AfendaResponsiveOverlay
        open={terminationOpen}
        onOpenChange={setTerminationOpen}
        title={closure ? "Edit termination details" : "Start termination & settlement"}
        description="Ending the agreement stops future schedule generation; the file remains open until final reconciliation passes."
        contentClassName="sm:max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setTerminationOpen(false)} disabled={busy}>Cancel</Button><Button disabled={busy || !effectiveDate || !terminationReason} onClick={async () => { const ok = await call(`/api/admin/corporate/obligations/${obligation.id}/closure`, "PUT", { terminationType, noticeDate: noticeDate || null, effectiveDate, handoverDate: handoverDate || null, terminationReason, terminationDocumentUrl: terminationDocumentUrl || null, notes: terminationNotes || null }, closure ? "Termination details updated." : "Termination recorded; file moved to reconciliation."); if (ok) setTerminationOpen(false); }}>Save termination</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AfendaField label="Termination type" id="termination-type" required guidance="How the agreement ended."><Input id="termination-type" list="termination-types" value={terminationType} onChange={(event) => setTerminationType(event.target.value)} /><datalist id="termination-types">{terminationTypes.map((value) => <option key={value} value={value} />)}</datalist></AfendaField>
          <AfendaField label="Notice date" id="termination-notice" guidance="Date notice was issued or received, where applicable."><Input id="termination-notice" type="date" value={noticeDate} onChange={(event) => setNoticeDate(event.target.value)} /></AfendaField>
          <AfendaField label="Effective termination date" id="termination-effective" required guidance="The contractual/effective end date. Future scheduling stops from this lifecycle closure."><Input id="termination-effective" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></AfendaField>
          <AfendaField label="Handover / vacate date" id="termination-handover" guidance="Physical handover, key return or final possession date, if applicable."><Input id="termination-handover" type="date" value={handoverDate} onChange={(event) => setHandoverDate(event.target.value)} /></AfendaField>
          <AfendaField label="Reason" id="termination-reason" required className="sm:col-span-2" guidance="Why the agreement ended. Keep this factual and auditable."><Textarea id="termination-reason" value={terminationReason} onChange={(event) => setTerminationReason(event.target.value)} /></AfendaField>
          <AfendaField label="Termination evidence URL" id="termination-evidence" className="sm:col-span-2" guidance="Notice, surrender, handover, landlord confirmation or other supporting evidence."><Input id="termination-evidence" type="url" value={terminationDocumentUrl} onChange={(event) => setTerminationDocumentUrl(event.target.value)} /></AfendaField>
          <AfendaField label="Notes" id="termination-notes" className="sm:col-span-2" guidance="Open questions or operational context for the reconciliation team."><Textarea id="termination-notes" value={terminationNotes} onChange={(event) => setTerminationNotes(event.target.value)} /></AfendaField>
        </div>
      </AfendaResponsiveOverlay>

      <AfendaResponsiveOverlay
        open={itemOpen}
        onOpenChange={setItemOpen}
        title="Add final reconciliation item"
        description="Use this for exit settlement items that are not already represented cleanly by an ordinary due item."
        contentClassName="sm:max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setItemOpen(false)} disabled={busy}>Cancel</Button><Button disabled={busy || !description || !currency} onClick={async () => { const ok = await call(`/api/admin/corporate/obligations/${obligation.id}/closure/items`, "POST", { category, direction, description, expectedAmount: expectedAmount === "" ? null : Number(expectedAmount), actualAmount: actualAmount === "" ? null : Number(actualAmount), currency, status: itemStatus, evidenceUrl: evidenceUrl || null, notes: itemNotes || null }, "Reconciliation item added."); if (ok) setItemOpen(false); }}>Add item</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AfendaField label="Category" id="recon-category" required guidance="Deposit, rental, cleaning or another final settlement category."><Input id="recon-category" list="reconciliation-categories" value={category} onChange={(event) => setCategory(event.target.value)} /><datalist id="reconciliation-categories">{reconciliationCategories.map((value) => <option key={value} value={value} />)}</datalist></AfendaField>
          <AfendaField label="Direction" id="recon-direction" required guidance="PAYABLE = organization owes; RECEIVABLE = organization should receive/refund/credit."><Input id="recon-direction" list="reconciliation-directions" value={direction} onChange={(event) => setDirection(event.target.value)} /><datalist id="reconciliation-directions">{reconciliationDirections.map((value) => <option key={value} value={value} />)}</datalist></AfendaField>
          <AfendaField label="Description" id="recon-description" required className="sm:col-span-2" guidance="Specific settlement fact, e.g. Security deposit refund, final cleaning charge, August rental adjustment."><Input id="recon-description" value={description} onChange={(event) => setDescription(event.target.value)} /></AfendaField>
          <AfendaField label="Expected amount" id="recon-expected" guidance="Amount expected from contract/SOA before final verification."><Input id="recon-expected" type="number" min="0" step="0.01" value={expectedAmount} onChange={(event) => setExpectedAmount(event.target.value)} /></AfendaField>
          <AfendaField label="Actual amount" id="recon-actual" guidance="Verified final amount. Can be entered later when still open/disputed."><Input id="recon-actual" type="number" min="0" step="0.01" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} /></AfendaField>
          <AfendaField label="Currency" id="recon-currency" required guidance="Settlement currency follows the obligation currency."><Input id="recon-currency" maxLength={3} value={currency} readOnly /></AfendaField>
          <AfendaField label="Status" id="recon-status" required guidance="Leave OPEN until verified; SETTLED or WAIVED clears the close-file gate; DISPUTED remains a blocker."><Input id="recon-status" list="reconciliation-statuses" value={itemStatus} onChange={(event) => setItemStatus(event.target.value)} /><datalist id="reconciliation-statuses">{reconciliationStatuses.map((value) => <option key={value} value={value} />)}</datalist></AfendaField>
          <AfendaField label="Evidence URL" id="recon-evidence" className="sm:col-span-2" guidance="SOA, refund proof, final invoice, clearance document or other evidence."><Input id="recon-evidence" type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} /></AfendaField>
          <AfendaField label="Notes" id="recon-notes" className="sm:col-span-2" guidance="Any uncertainty, waiver rationale or reconciliation explanation."><Textarea id="recon-notes" value={itemNotes} onChange={(event) => setItemNotes(event.target.value)} /></AfendaField>
        </div>
      </AfendaResponsiveOverlay>

      <AfendaResponsiveOverlay
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Resolve reconciliation item"
        description={editing ? `${editing.category.replaceAll("_", " ")} · ${editing.description}` : "Update final settlement evidence and status."}
        footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button disabled={busy || !editing} onClick={async () => { if (!editing) return; const ok = await call(`/api/admin/corporate/closure-items/${editing.id}`, "PATCH", { actualAmount: actualAmount === "" ? null : Number(actualAmount), status: itemStatus, evidenceUrl: evidenceUrl || null, notes: itemNotes || null }, "Reconciliation item updated."); if (ok) setEditing(null); }}>Save resolution</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AfendaField label="Actual amount" id="resolve-actual" guidance="Final verified amount."><Input id="resolve-actual" type="number" min="0" step="0.01" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} /></AfendaField>
          <AfendaField label="Status" id="resolve-status" required guidance="SETTLED or WAIVED clears this item. DISPUTED and OPEN continue to block closure."><Input id="resolve-status" list="resolve-statuses" value={itemStatus} onChange={(event) => setItemStatus(event.target.value)} /><datalist id="resolve-statuses">{reconciliationStatuses.map((value) => <option key={value} value={value} />)}</datalist></AfendaField>
          <AfendaField label="Evidence URL" id="resolve-evidence" className="sm:col-span-2" guidance="Final proof supporting the resolution."><Input id="resolve-evidence" type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} /></AfendaField>
          <AfendaField label="Resolution notes" id="resolve-notes" className="sm:col-span-2" guidance="Explain settlement, waiver, dispute or variance where useful."><Textarea id="resolve-notes" value={itemNotes} onChange={(event) => setItemNotes(event.target.value)} /></AfendaField>
        </div>
      </AfendaResponsiveOverlay>
    </div>
  );
}

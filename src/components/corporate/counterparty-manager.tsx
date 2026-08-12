"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CounterpartyFormFields, EMPTY_COUNTERPARTY, type CounterpartyDraft } from "@/components/corporate/counterparty-form-fields";
import type { CorporateCustomFieldDefinitionDto } from "@/components/corporate/custom-field-controls";

export type CounterpartyRow = CounterpartyDraft & { id: string; obligations: number };

export function CounterpartyManager({ rows, definitions, isAdmin }: {
  rows: CounterpartyRow[];
  definitions: CorporateCustomFieldDefinitionDto[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CounterpartyDraft>(EMPTY_COUNTERPARTY);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CounterpartyDraft>(key: K, value: CounterpartyDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function openCreate() { setDraft(EMPTY_COUNTERPARTY); setEditingId(null); setDialog("create"); }
  function openEdit(row: CounterpartyRow) {
    const { id, obligations: _obligations, ...values } = row;
    void _obligations;
    setDraft(values); setEditingId(id); setDialog("edit");
  }

  async function save() {
    setBusy(true);
    const payload = { ...draft, code: draft.code || null, paymentTermsDays: draft.paymentTermsDays === "" ? null : Number(draft.paymentTermsDays) };
    try {
      const response = await fetch(editingId ? `/api/admin/corporate/counterparties/${editingId}` : "/api/admin/corporate/counterparties", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not save counterparty");
      toast.success(editingId ? "Counterparty updated." : "Counterparty created.");
      setDialog(null); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save counterparty"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin ? <div className="flex justify-end"><Button onClick={openCreate}>Add counterparty</Button></div> : null}
      <Card>
        <CardHeader><CardTitle>Counterparties</CardTitle><CardDescription>Domain-local registry for landlords, vendors, insurers, financiers, service providers and agencies.</CardDescription></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty className="border border-dashed"><EmptyHeader><EmptyTitle>No counterparties yet</EmptyTitle><EmptyDescription>Create one before registering an obligation.</EmptyDescription></EmptyHeader></Empty>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Obligations</TableHead><TableHead>Status</TableHead>{isAdmin ? <TableHead /> : null}</TableRow></TableHeader>
                  <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-mono text-xs">{row.code}</TableCell><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.type.replaceAll("_", " ")}</TableCell><TableCell className="text-muted-foreground">{row.contactName || row.contactEmail || "—"}</TableCell><TableCell className="text-right tabular-nums">{row.obligations}</TableCell><TableCell><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></TableCell>{isAdmin ? <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button></TableCell> : null}</TableRow>)}</TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden">{rows.map((row) => <li key={row.id} className="flex flex-col gap-3 rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.name}</p><p className="font-mono text-xs text-muted-foreground">{row.code}</p></div><Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div><p className="text-sm text-muted-foreground">{row.type.replaceAll("_", " ")} · {row.obligations} obligation{row.obligations === 1 ? "" : "s"}</p>{isAdmin ? <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit details</Button> : null}</li>)}</ul>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit counterparty" : "Add counterparty"}</DialogTitle><DialogDescription>Core fields stay reportable; custom fields cover organisation-specific details.</DialogDescription></DialogHeader>
          <CounterpartyFormFields draft={draft} set={set} definitions={definitions} />
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !draft.name.trim()}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

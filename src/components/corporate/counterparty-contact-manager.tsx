"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { AfendaSection } from "@/components/afenda/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type CounterpartyContactRow = {
  id: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  role: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
};

function ContactFieldGrid({
  name, setName,
  jobTitle, setJobTitle,
  department, setDepartment,
  email, setEmail,
  phone, setPhone,
  mobile, setMobile,
  role, setRole,
  isPrimary, setIsPrimary,
  notes, setNotes,
}: {
  name: string; setName: (value: string) => void;
  jobTitle: string; setJobTitle: (value: string) => void;
  department: string; setDepartment: (value: string) => void;
  email: string; setEmail: (value: string) => void;
  phone: string; setPhone: (value: string) => void;
  mobile: string; setMobile: (value: string) => void;
  role: string; setRole: (value: string) => void;
  isPrimary: boolean; setIsPrimary: (value: boolean) => void;
  notes: string; setNotes: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AfendaField label="Name" id="contact-name" required><Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} /></AfendaField>
      <AfendaField label="Role" id="contact-role"><Input id="contact-role" value={role} onChange={(e) => setRole(e.target.value.toUpperCase())} placeholder="BILLING / TECHNICAL / EMERGENCY" /></AfendaField>
      <AfendaField label="Job title" id="contact-title"><Input id="contact-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></AfendaField>
      <AfendaField label="Department" id="contact-dept"><Input id="contact-dept" value={department} onChange={(e) => setDepartment(e.target.value)} /></AfendaField>
      <AfendaField label="Email" id="contact-email"><Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></AfendaField>
      <AfendaField label="Mobile" id="contact-mobile"><Input id="contact-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} /></AfendaField>
      <AfendaField label="Phone" id="contact-phone"><Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></AfendaField>
      <div className="sm:pt-1"><AfendaCheckField label="Primary contact" checked={isPrimary} onChange={setIsPrimary} /></div>
      <AfendaField label="Notes" id="contact-notes" className="sm:col-span-2"><Textarea id="contact-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></AfendaField>
    </div>
  );
}

export function CounterpartyContactManager({ counterpartyId, rows, isAdmin }: { counterpartyId: string; rows: CounterpartyContactRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<CounterpartyContactRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function resetForm() {
    setName(""); setJobTitle(""); setDepartment(""); setEmail(""); setPhone(""); setMobile(""); setRole(""); setIsPrimary(false); setNotes("");
  }

  function beginAdd() {
    resetForm();
    setOpen(true);
  }

  function beginEdit(row: CounterpartyContactRow) {
    setName(row.name);
    setJobTitle(row.jobTitle ?? "");
    setDepartment(row.department ?? "");
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setMobile(row.mobile ?? "");
    setRole(row.role ?? "");
    setIsPrimary(row.isPrimary);
    setNotes(row.notes ?? "");
    setEditing(row);
  }

  async function add() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/counterparties/${counterpartyId}/contacts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, jobTitle: jobTitle || null, department: department || null, email: email || null, phone: phone || null, mobile: mobile || null, role: role || null, isPrimary, isActive: true, notes: notes || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not add contact");
      toast.success("Contact added.");
      setOpen(false); resetForm(); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add contact"); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/counterparties/${counterpartyId}/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          name,
          jobTitle: jobTitle || null,
          department: department || null,
          email: email || null,
          phone: phone || null,
          mobile: mobile || null,
          role: role || null,
          isPrimary,
          notes: notes || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update contact");
      toast.success("Contact updated.");
      setEditing(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update contact"); }
    finally { setBusy(false); }
  }

  async function setContactActive(row: CounterpartyContactRow, isActive: boolean) {
    setUpdatingId(row.id);
    try {
      const response = await fetch(`/api/admin/corporate/counterparties/${counterpartyId}/contacts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update contact");
      toast.success(isActive ? "Contact reactivated." : "Contact deactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update contact"); }
    finally { setUpdatingId(null); }
  }

  return <>
    <AfendaSection title="Contacts" description="Keep billing, account, technical and emergency people separate instead of overloading one counterparty contact." actions={isAdmin ? <Button size="sm" onClick={beginAdd}>Add contact</Button> : undefined}>
      {rows.length === 0 ? <AfendaEmptyState compact title="No contacts" description="Add the people users need for billing, administration, service delivery or emergencies." /> : <ul className="grid gap-3 md:grid-cols-2">{rows.map((row) => <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.name}</p><p className="text-sm text-muted-foreground">{[row.jobTitle, row.department].filter(Boolean).join(" · ") || row.role || "Contact"}</p></div><div className="flex flex-wrap gap-1">{row.isPrimary ? <Badge variant="outline">Primary</Badge> : null}<Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div></div><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Role</dt><dd>{row.role?.replaceAll("_", " ") || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{row.email || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{row.mobile || row.phone || "—"}</dd></div></dl>{isAdmin ? <div className="mt-3 flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(row)}>Edit</Button>
    {row.isActive
      ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate contact?" description="The contact stays in history and on past records, but is no longer offered as a current contact." confirmLabel="Deactivate" onConfirm={() => setContactActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
      : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setContactActive(row, true)}>Reactivate</Button>}
  </div> : null}</li>)}</ul>}
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add counterparty contact" description="Create a named contact with a clear operating role. Mark one as primary only when it is the normal default contact." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void add()} disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add contact"}</Button></>}>
      <ContactFieldGrid
        name={name} setName={setName}
        jobTitle={jobTitle} setJobTitle={setJobTitle}
        department={department} setDepartment={setDepartment}
        email={email} setEmail={setEmail}
        phone={phone} setPhone={setPhone}
        mobile={mobile} setMobile={setMobile}
        role={role} setRole={setRole}
        isPrimary={isPrimary} setIsPrimary={setIsPrimary}
        notes={notes} setNotes={setNotes}
      />
    </AfendaResponsiveOverlay>

    <AfendaResponsiveOverlay open={editing !== null} onOpenChange={(next) => !next && setEditing(null)} title={editing ? `Edit ${editing.name}` : "Edit contact"} description="Correct this contact's details. Leaving a field blank clears it." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save changes"}</Button></>}>
      <ContactFieldGrid
        name={name} setName={setName}
        jobTitle={jobTitle} setJobTitle={setJobTitle}
        department={department} setDepartment={setDepartment}
        email={email} setEmail={setEmail}
        phone={phone} setPhone={setPhone}
        mobile={mobile} setMobile={setMobile}
        role={role} setRole={setRole}
        isPrimary={isPrimary} setIsPrimary={setIsPrimary}
        notes={notes} setNotes={setNotes}
      />
    </AfendaResponsiveOverlay>
  </>;
}

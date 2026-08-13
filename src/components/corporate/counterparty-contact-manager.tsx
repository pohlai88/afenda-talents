"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
};

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
      setOpen(false); setName(""); setJobTitle(""); setDepartment(""); setEmail(""); setPhone(""); setMobile(""); setRole(""); setIsPrimary(false); setNotes(""); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add contact"); }
    finally { setBusy(false); }
  }

  return <>
    <AfendaSection title="Contacts" description="Keep billing, account, technical and emergency people separate instead of overloading one counterparty contact." actions={isAdmin ? <Button size="sm" onClick={() => setOpen(true)}>Add contact</Button> : undefined}>
      {rows.length === 0 ? <AfendaEmptyState compact title="No contacts" description="Add the people users need for billing, administration, service delivery or emergencies." /> : <ul className="grid gap-3 md:grid-cols-2">{rows.map((row) => <li key={row.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.name}</p><p className="text-sm text-muted-foreground">{[row.jobTitle, row.department].filter(Boolean).join(" · ") || row.role || "Contact"}</p></div><div className="flex flex-wrap gap-1">{row.isPrimary ? <Badge variant="outline">Primary</Badge> : null}<Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Active" : "Inactive"}</Badge></div></div><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Role</dt><dd>{row.role?.replaceAll("_", " ") || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{row.email || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{row.mobile || row.phone || "—"}</dd></div></dl></li>)}</ul>}
    </AfendaSection>

    <AfendaResponsiveOverlay open={open} onOpenChange={setOpen} title="Add counterparty contact" description="Create a named contact with a clear operating role. Mark one as primary only when it is the normal default contact." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void add()} disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add contact"}</Button></>}>
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
    </AfendaResponsiveOverlay>
  </>;
}

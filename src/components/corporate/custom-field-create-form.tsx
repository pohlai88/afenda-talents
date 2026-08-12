"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const scopes = ["COUNTERPARTY", "OBLIGATION", "DUE_ITEM", "PAYMENT"] as const;
const types = ["TEXT", "LONG_TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "URL", "EMAIL", "PHONE"] as const;

export function CustomFieldCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<(typeof scopes)[number]>("OBLIGATION");
  const [dataType, setDataType] = useState<(typeof types)[number]>("TEXT");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [showInList, setShowInList] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/admin/corporate/custom-fields", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, key, label, dataType, description: description || null, placeholder: placeholder || null, required, showInList, sortOrder: 0, options: dataType === "SELECT" ? options.split("\n").map((item) => item.trim()).filter(Boolean) : null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not create custom field");
      toast.success("Custom field created.");
      setKey(""); setLabel(""); setDescription(""); setPlaceholder(""); setOptions(""); setRequired(false); setShowInList(false);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create custom field"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader><CardTitle>Add custom field</CardTitle><CardDescription>Add organisation-specific information without a database migration. Keys are stable; labels can evolve.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Record type" id="cf-scope"><Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}><SelectTrigger id="cf-scope" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{scopes.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ").toLowerCase()}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field label="Field type" id="cf-type"><Select value={dataType} onValueChange={(v) => setDataType(v as typeof dataType)}><SelectTrigger id="cf-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{types.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ").toLowerCase()}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field label="Stable key *" id="cf-key"><Input id="cf-key" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="policy_number" required /></Field>
          <Field label="Label *" id="cf-label"><Input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Policy number" required /></Field>
          <Field label="Placeholder" id="cf-placeholder"><Input id="cf-placeholder" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} /></Field>
          <div className="flex flex-col gap-3 pt-6"><label className="flex items-center gap-3 text-sm"><Checkbox checked={required} onCheckedChange={(v) => setRequired(v === true)} />Required</label><label className="flex items-center gap-3 text-sm"><Checkbox checked={showInList} onCheckedChange={(v) => setShowInList(v === true)} />Available for list views</label></div>
          <Field label="Help text" id="cf-description" className="sm:col-span-2"><Textarea id="cf-description" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          {dataType === "SELECT" ? <Field label="Options — one per line *" id="cf-options" className="sm:col-span-2"><Textarea id="cf-options" value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"Monthly\nQuarterly\nAnnual"} required /></Field> : null}
        </CardContent>
        <CardFooter><Button type="submit" disabled={busy || !key || !label}>{busy ? "Adding…" : "Add field"}</Button></CardFooter>
      </Card>
    </form>
  );
}
function Field({ label, id, children, className = "" }: { label: string; id: string; children: React.ReactNode; className?: string }) { return <div className={`flex flex-col gap-2 ${className}`}><Label htmlFor={id}>{label}</Label>{children}</div>; }

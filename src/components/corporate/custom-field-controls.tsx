"use client";

import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type CorporateCustomFieldDefinitionDto = {
  id: string;
  scope: "COUNTERPARTY" | "SITE" | "OBLIGATION" | "DUE_ITEM" | "PAYMENT";
  key: string;
  label: string;
  dataType: "TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT" | "URL" | "EMAIL" | "PHONE";
  description: string | null;
  placeholder: string | null;
  required: boolean;
  options: string[];
  showInList: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function CustomFieldControls({ definitions, values, onChange }: {
  definitions: CorporateCustomFieldDefinitionDto[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  if (definitions.length === 0) return null;

  return (
    <FieldSet className="rounded-lg border p-4">
      <FieldLegend>Custom fields</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        {definitions.map((field) => {
          const value = values[field.key];
          const set = (next: unknown) => onChange({ ...values, [field.key]: next });
          const id = `custom-${field.scope.toLowerCase()}-${field.key}`;
          if (field.dataType === "BOOLEAN") {
            return <AfendaCheckField key={field.id} label={field.label} checked={value === true} onChange={set} description={field.description ?? field.placeholder ?? undefined} />;
          }
          return (
            <AfendaField key={field.id} label={field.label} id={id} required={field.required} description={field.description ?? undefined} className={field.dataType === "LONG_TEXT" ? "sm:col-span-2" : undefined}>
              {field.dataType === "LONG_TEXT" ? <Textarea id={id} value={typeof value === "string" ? value : ""} placeholder={field.placeholder ?? undefined} required={field.required} onChange={(event) => set(event.target.value)} /> : field.dataType === "SELECT" ? <Select value={typeof value === "string" ? value : ""} onValueChange={(next) => set(next)}><SelectTrigger id={id} className="w-full"><SelectValue placeholder={field.placeholder || "Select"} /></SelectTrigger><SelectContent><SelectGroup>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectGroup></SelectContent></Select> : <Input id={id} type={field.dataType === "NUMBER" ? "number" : field.dataType === "DATE" ? "date" : field.dataType === "EMAIL" ? "email" : field.dataType === "URL" ? "url" : field.dataType === "PHONE" ? "tel" : "text"} value={field.dataType === "NUMBER" ? (typeof value === "number" ? String(value) : "") : (typeof value === "string" ? value : "")} placeholder={field.placeholder ?? undefined} required={field.required} onChange={(event) => set(field.dataType === "NUMBER" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)} />}
            </AfendaField>
          );
        })}
      </FieldGroup>
    </FieldSet>
  );
}

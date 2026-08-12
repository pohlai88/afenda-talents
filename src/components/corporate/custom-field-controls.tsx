"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type CorporateCustomFieldDefinitionDto = {
  id: string;
  scope: "COUNTERPARTY" | "OBLIGATION" | "DUE_ITEM" | "PAYMENT";
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

export function CustomFieldControls({
  definitions,
  values,
  onChange,
}: {
  definitions: CorporateCustomFieldDefinitionDto[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  if (definitions.length === 0) return null;
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium">Custom fields</legend>
      {definitions.map((field) => {
        const value = values[field.key];
        const set = (next: unknown) => onChange({ ...values, [field.key]: next });
        const id = `custom-${field.scope.toLowerCase()}-${field.key}`;
        return (
          <div key={field.id} className={field.dataType === "LONG_TEXT" ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"}>
            <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
            {field.dataType === "LONG_TEXT" ? (
              <Textarea id={id} value={typeof value === "string" ? value : ""} placeholder={field.placeholder ?? undefined} required={field.required} onChange={(event) => set(event.target.value)} />
            ) : field.dataType === "BOOLEAN" ? (
              <label className="flex min-h-8 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={value === true} onCheckedChange={(checked) => set(checked === true)} />
                <span>{field.placeholder || "Yes / enabled"}</span>
              </label>
            ) : field.dataType === "SELECT" ? (
              <Select value={typeof value === "string" ? value : ""} onValueChange={(next) => set(next)}>
                <SelectTrigger id={id} className="w-full"><SelectValue placeholder={field.placeholder || "Select"} /></SelectTrigger>
                <SelectContent><SelectGroup>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                type={field.dataType === "NUMBER" ? "number" : field.dataType === "DATE" ? "date" : field.dataType === "EMAIL" ? "email" : field.dataType === "URL" ? "url" : field.dataType === "PHONE" ? "tel" : "text"}
                value={field.dataType === "NUMBER" ? (typeof value === "number" ? String(value) : "") : (typeof value === "string" ? value : "")}
                placeholder={field.placeholder ?? undefined}
                required={field.required}
                onChange={(event) => set(field.dataType === "NUMBER" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)}
              />
            )}
            {field.description ? <p className="text-xs leading-5 text-muted-foreground">{field.description}</p> : null}
          </div>
        );
      })}
    </fieldset>
  );
}

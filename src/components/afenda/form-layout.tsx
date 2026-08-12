"use client";

import type { ReactNode } from "react";

import { AfendaGuidanceButton } from "@/components/afenda/guidance-sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import type { AfendaGuidance } from "@/lib/afenda-guidance";
import { cn } from "@/lib/utils";

export function AfendaField({
  label,
  id,
  children,
  className,
  required = false,
  guidance,
  description,
}: {
  label: string;
  id: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
  guidance?: AfendaGuidance;
  description?: string;
}) {
  const helper = guidance?.summary ?? description;

  return (
    <Field className={className}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <FieldLabel htmlFor={id} className="pt-1">
          <span>{label}</span>
          {required ? <span aria-hidden="true"> *</span> : null}
        </FieldLabel>
        {guidance ? <AfendaGuidanceButton title={label} guidance={guidance} /> : null}
      </div>
      {children}
      {helper ? <FieldDescription>{helper}</FieldDescription> : null}
    </Field>
  );
}

export function AfendaCheckField({
  label,
  checked,
  onChange,
  guidance,
  description,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  guidance?: AfendaGuidance;
  description?: string;
  className?: string;
}) {
  const helper = guidance?.summary ?? description;

  return (
    <Field orientation="horizontal" className={cn("rounded-lg border p-3", className)}>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <FieldContent>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <FieldTitle>{label}</FieldTitle>
          {guidance ? <AfendaGuidanceButton title={label} guidance={guidance} /> : null}
        </div>
        {helper ? <FieldDescription>{helper}</FieldDescription> : null}
      </FieldContent>
    </Field>
  );
}

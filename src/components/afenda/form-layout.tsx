"use client";

import { useId, type ReactNode } from "react";

import { AfendaGuidanceButton } from "@/components/afenda/guidance-sheet";
import { useAfendaGuidedMode } from "@/components/afenda/guided-mode";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
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
  const { enabled } = useAfendaGuidedMode();
  const helper = guidance?.summary ?? description;
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <Field
      className={className}
      aria-labelledby={labelId}
      aria-describedby={enabled && helper ? descriptionId : undefined}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <FieldLabel id={labelId} htmlFor={id} className="pt-1">
          <span>{label}</span>
          {required ? <><span aria-hidden="true"> *</span><span className="sr-only"> (required)</span></> : null}
        </FieldLabel>
        {guidance ? <AfendaGuidanceButton title={label} guidance={guidance} /> : null}
      </div>
      {children}
      {enabled && helper ? <FieldDescription id={descriptionId}>{helper}</FieldDescription> : null}
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
  const generatedId = useId();
  const { enabled } = useAfendaGuidedMode();
  const helper = guidance?.summary ?? description;
  const controlId = `afenda-check-${generatedId.replaceAll(":", "")}`;
  const descriptionId = `${controlId}-description`;

  return (
    <Field orientation="horizontal" className={cn("rounded-lg border p-3", className)}>
      <Checkbox
        id={controlId}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-describedby={enabled && helper ? descriptionId : undefined}
      />
      <FieldContent>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
          {guidance ? <AfendaGuidanceButton title={label} guidance={guidance} /> : null}
        </div>
        {enabled && helper ? <FieldDescription id={descriptionId}>{helper}</FieldDescription> : null}
      </FieldContent>
    </Field>
  );
}

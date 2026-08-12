"use client";

import type { ReactNode } from "react";

import { AfendaCheckField, AfendaField } from "@/components/afenda/form-layout";
import type { AfendaGuidance } from "@/lib/afenda-guidance";

export function CorporateField({
  label,
  id,
  children,
  className,
  required,
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
  return (
    <AfendaField
      label={label}
      id={id}
      className={className}
      required={required}
      guidance={guidance}
      description={description}
    >
      {children}
    </AfendaField>
  );
}

export function CorporateCheckField({
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
  return (
    <AfendaCheckField
      label={label}
      checked={checked}
      onChange={onChange}
      guidance={guidance}
      description={description}
      className={className}
    />
  );
}

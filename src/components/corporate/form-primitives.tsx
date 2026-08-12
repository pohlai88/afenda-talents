"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function CorporateField({ label, id, children, className = "" }: { label: string; id: string; children: React.ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-2 ${className}`}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

export function CorporateCheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <span>{label}</span>
    </label>
  );
}

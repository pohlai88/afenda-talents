"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AfendaSelectFilterOption = {
  value: string;
  label: string;
};

export function AfendaSelectFilter({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: AfendaSelectFilterOption[];
  ariaLabel: string;
  className?: string;
}) {
  // Base UI's SelectValue renders the raw `value` unless Root is given an items
  // map — SelectItem children are not used for the closed trigger. Without this,
  // every filter in the workspace showed its code ("ACTIVE", "DUE_ITEM") rather
  // than the label sitting right there in `options`.
  const labels = Object.fromEntries(options.map((option) => [option.value, option.label]));

  return (
    <Select items={labels} value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

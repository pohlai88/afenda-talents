"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleHelp } from "lucide-react";

import { AfendaGuidedModeToggle } from "@/components/afenda/guided-mode";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AfendaGuidance } from "@/lib/afenda-guidance";

const GUIDANCE_ROWS: Array<{ key: keyof Pick<AfendaGuidance, "what" | "why" | "who" | "when" | "how">; label: string }> = [
  { key: "what", label: "What" },
  { key: "why", label: "Why" },
  { key: "who", label: "Who" },
  { key: "when", label: "When" },
  { key: "how", label: "How" },
];

function inferredManualHref(title: string): string {
  const value = title.toLowerCase();
  if (value.includes("payment") || value.includes("approved") || value.includes("paid") || value.includes("settlement") || value.includes("reconcil")) return "/admin/corporate/help#payments";
  if (value.includes("invoice") || value.includes("due") || value.includes("period label") || value.includes("dispute")) return "/admin/corporate/help#due-items";
  if (value.includes("counterpart") || value.includes("registration") || value.includes("tax id") || value.includes("payment terms")) return "/admin/corporate/help#counterparties";
  if (value.includes("custom") || value.includes("field type") || value.includes("stable key") || value.includes("record type") || value.includes("show in list") || value.includes("select options")) return "/admin/corporate/help#custom-fields";
  return "/admin/corporate/help#obligations";
}

function GuidanceSheet({
  title,
  guidance,
  open,
  onOpenChange,
}: {
  title: string;
  guidance: AfendaGuidance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const manualHref = guidance.manualHref ?? inferredManualHref(title);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{guidance.summary}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <dl className="flex flex-col gap-4">
            {GUIDANCE_ROWS.map(({ key, label }) => (
              <div key={key} className="grid gap-1">
                <dt className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd className="text-sm leading-6 text-foreground">{guidance[key]}</dd>
              </div>
            ))}
          </dl>
          {guidance.example ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Example
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground">{guidance.example}</p>
            </div>
          ) : null}
          <Button variant="outline" nativeButton={false} render={<Link href={manualHref} />}>
            Open full manual
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AfendaGuidanceButton({
  title,
  guidance,
}: {
  title: string;
  guidance: AfendaGuidance;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Help for ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <CircleHelp aria-hidden="true" />
      </Button>
      <GuidanceSheet title={title} guidance={guidance} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AfendaPageHelp({
  title,
  guidance,
  label = "How this works",
}: {
  title: string;
  guidance: AfendaGuidance;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <CircleHelp data-icon="inline-start" aria-hidden="true" />
        {label}
      </Button>
      <AfendaGuidedModeToggle />
      <GuidanceSheet title={title} guidance={guidance} open={open} onOpenChange={setOpen} />
    </div>
  );
}

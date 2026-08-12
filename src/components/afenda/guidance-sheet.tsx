"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";

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
        onClick={() => setOpen(true)}
      >
        <CircleHelp aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

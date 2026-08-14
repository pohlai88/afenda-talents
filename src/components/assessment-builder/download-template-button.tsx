"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DownloadFormat, TemplateKind } from "@/lib/instrument-download";

const KIND_COPY: Array<{ value: TemplateKind; label: string; hint: string }> = [
  {
    value: "blank",
    label: "Blank template",
    hint: "Empty structure with one worked row and Excel dropdowns.",
  },
  {
    value: "core",
    label: "Core example",
    hint: "The behavioural profile, filled in — five dimensions, three bands.",
  },
  {
    value: "sales",
    label: "Sales example",
    hint: "A larger instrument — twelve dimensions, five bands, six essays.",
  },
];

const FORMAT_COPY: Array<{ value: DownloadFormat; label: string; hint: string }> = [
  { value: "xlsx", label: "Excel", hint: "Dropdowns and one sheet per part. Best for authoring." },
  { value: "json", label: "JSON", hint: "Full fidelity, for ops." },
  {
    value: "csv",
    label: "CSV",
    hint: "Items only. Updates an assessment that already exists — it cannot create one.",
  },
];

/** Download a starting point. Nothing is written, so there is no preview step. */
export function DownloadTemplateButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TemplateKind>("blank");
  const [format, setFormat] = useState<DownloadFormat>("xlsx");

  const formatHint = FORMAT_COPY.find((f) => f.value === format)?.hint ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <DownloadIcon />
        Download template
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download a template</DialogTitle>
          <DialogDescription>
            Author the instrument offline, then upload it with Import. Nothing here
            changes the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Label className="flex flex-col gap-1.5">
            Starting point
            <Select value={kind} onValueChange={(v) => setKind(v as TemplateKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_COPY.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {KIND_COPY.find((k) => k.value === kind)?.hint}
            </span>
          </Label>

          <Label className="flex flex-col gap-1.5">
            Format
            <Select value={format} onValueChange={(v) => setFormat(v as DownloadFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_COPY.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{formatHint}</span>
          </Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            nativeButton={false}
            render={
              <a
                href={`/api/admin/assessments/template?kind=${kind}&format=${format}`}
                download
              />
            }
            onClick={() => setOpen(false)}
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

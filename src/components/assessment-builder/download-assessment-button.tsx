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
import type { DownloadFormat } from "@/lib/instrument-download";

/** Row action: download this assessment to edit offline and upload back. */
export function DownloadAssessmentButton({
  assessmentId,
  hasPublishedVersion,
}: {
  assessmentId: string;
  hasPublishedVersion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<DownloadFormat>("xlsx");
  const [source, setSource] = useState<"draft" | "published">("draft");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <DownloadIcon />
        Download
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download this assessment</DialogTitle>
          <DialogDescription>
            Edit it offline and upload it back with Import. Excel keeps a hidden record
            of where it came from, so the upload knows what changed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Label className="flex flex-col gap-1.5">
            Version
            <Select
              value={source}
              onValueChange={(v) => setSource(v as "draft" | "published")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Current draft</SelectItem>
                <SelectItem value="published" disabled={!hasPublishedVersion}>
                  Latest published
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {hasPublishedVersion
                ? "The draft falls back to the latest published version when no draft is open."
                : "This assessment has no published version yet."}
            </span>
          </Label>

          <Label className="flex flex-col gap-1.5">
            Format
            <Select value={format} onValueChange={(v) => setFormat(v as DownloadFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV — items only</SelectItem>
              </SelectContent>
            </Select>
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
                href={`/api/admin/assessments/${assessmentId}/export?format=${format}&source=${source}`}
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

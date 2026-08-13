import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";

import { AfendaCopyButton } from "@/components/afenda/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type AfendaEvidenceItem = {
  label: string;
  reference?: string | null;
  href?: string | null;
  required?: boolean;
  note?: string | null;
};

function evidenceState(item: AfendaEvidenceItem): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (item.href) return { label: "Available", variant: "default" };
  if (item.required) return { label: "Required", variant: "destructive" };
  return { label: "Not attached", variant: "outline" };
}

export function AfendaEvidenceList({
  title = "Evidence & references",
  description = "Keep source documents and external references next to the operational record they support.",
  items,
}: {
  title?: string;
  description?: string;
  items: AfendaEvidenceItem[];
}) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-0" aria-label={`${title} items`}>
          {items.map((item, index) => {
            const state = evidenceState(item);
            return (
              <li key={`${item.label}-${index}`}>
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                      <FileText aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{item.label}</p>
                        <Badge variant={state.variant}>{state.label}</Badge>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {item.reference || "No reference recorded"}
                      </p>
                      {item.note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</p> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
                    {item.reference ? <AfendaCopyButton value={item.reference} label={`Copy ${item.label} reference`} /> : null}
                    {item.href ? (
                      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={item.href} target="_blank" rel="noreferrer" aria-label={`Open ${item.label} evidence in a new tab`} />}>
                        <ExternalLink data-icon="inline-start" aria-hidden="true" />
                        Open evidence
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

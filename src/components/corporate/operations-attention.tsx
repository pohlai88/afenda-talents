import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationsReviewSignal } from "@/lib/corporate-admin/operations-intelligence";

export function OperationsAttention({ signals }: { signals: OperationsReviewSignal[] }) {
  const visible = signals.slice(0, 8);
  const actionCount = signals.filter((signal) => signal.severity === "ACTION").length;

  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Operator attention</CardTitle>
          <CardDescription>Deterministic review signals derived from the Corporate relationship graph. They identify records to inspect; they do not invent company policy.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Badge variant={actionCount > 0 ? "destructive" : "secondary"}>{actionCount} action</Badge>
          <Badge variant="outline">{signals.length - actionCount} review</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No current relationship or schedule signals require review.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((signal) => (
              <li key={signal.id}>
                <Link href={signal.href} className="flex flex-col gap-1 p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="min-w-0"><span className="block font-medium">{signal.title}</span><span className="block text-xs leading-5 text-muted-foreground">{signal.detail}</span></span>
                  <Badge className="shrink-0" variant={signal.severity === "ACTION" ? "destructive" : "outline"}>{signal.severity === "ACTION" ? "Action" : "Review"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {signals.length > visible.length ? <p className="mt-3 text-xs text-muted-foreground">Showing {visible.length} of {signals.length} current signals. Use the Operations Grid “Attention only” filter for the full working set.</p> : null}
      </CardContent>
    </Card>
  );
}

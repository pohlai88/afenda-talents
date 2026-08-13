import { AfendaMetricCard } from "@/components/afenda/metric-card";
import { AfendaSection } from "@/components/afenda/section";
import { CorporateStatusBadge, formatMoney } from "@/components/corporate/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ObligationLineSummaryRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  recurring: boolean;
  nextDueDate: string | null;
  dueCount: number;
  recentDues: Array<{
    id: string;
    periodLabel: string;
    dueDate: string;
    status: "OPEN" | "COMPLETED" | "CANCELLED";
    amount: number | null;
    currency: string;
  }>;
};

export function ObligationLineSummary({ lines }: { lines: ObligationLineSummaryRow[] }) {
  const activeLines = lines.filter((line) => line.isActive);
  const recurringLines = activeLines.filter((line) => line.recurring);
  const attentionLines = recurringLines.filter((line) => !line.nextDueDate);
  const dueItems = lines.reduce((total, line) => total + line.dueCount, 0);
  const recent = lines
    .flatMap((line) => line.recentDues.map((due) => ({ ...due, lineCode: line.code, lineName: line.name })))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 8);

  return (
    <>
      <section aria-label="Agreement line summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AfendaMetricCard label="Active lines" value={activeLines.length} description="Payable or scheduled components" />
        <AfendaMetricCard label="Recurring lines" value={recurringLines.length} description="Independent recurring schedules" />
        <AfendaMetricCard label="Due items" value={dueItems} description="Occurrences generated from lines" />
        <AfendaMetricCard label="Schedule attention" value={attentionLines.length} description="Active recurring lines without next due" />
      </section>

      <AfendaSection
        title="Recent line activity"
        description="Every occurrence stays attributable to the commercial line that generated it, even when several lines share the same due date."
      >
        {recent.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No line due items yet</CardTitle>
              <CardDescription>Generate or add a due item from a specific agreement line to begin line-level history.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {recent.map((due) => (
              <Card key={due.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{due.lineName}</CardTitle>
                      <CardDescription><span className="font-mono">{due.lineCode}</span> · {due.periodLabel}</CardDescription>
                    </div>
                    <CorporateStatusBadge status={due.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Due {due.dueDate}</span>
                  <span className="font-medium tabular-nums">{formatMoney(due.currency, due.amount)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AfendaSection>
    </>
  );
}

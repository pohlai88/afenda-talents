export type OperationsReviewSignal = {
  id: string;
  severity: "ACTION" | "REVIEW";
  title: string;
  detail: string;
  href: string;
};

export type OperationsSiteSignalInput = {
  id: string;
  name: string;
  activeCoverageCount: number;
};

export type OperationsLineSignalInput = {
  id: string;
  obligationId: string;
  obligationTitle: string;
  code: string;
  name: string;
  active: boolean;
  obligationActive: boolean;
  recurring: boolean;
  nextDueDate: string | null;
  overdueDueCount: number;
};

export function deriveOperationsReviewSignals(
  sites: OperationsSiteSignalInput[],
  lines: OperationsLineSignalInput[],
): OperationsReviewSignal[] {
  const signals: OperationsReviewSignal[] = [];

  for (const site of sites) {
    if (site.activeCoverageCount === 0) {
      signals.push({
        id: `site-coverage:${site.id}`,
        severity: "REVIEW",
        title: `${site.name} has no active service coverage recorded`,
        detail: "Review whether this is intentional or whether a provider relationship is missing.",
        href: `/admin/corporate/sites/${site.id}`,
      });
    }
  }

  for (const line of lines) {
    if (!line.active || !line.obligationActive) continue;
    if (line.recurring && !line.nextDueDate) {
      signals.push({
        id: `line-schedule:${line.id}`,
        severity: "ACTION",
        title: `${line.name} has no next due date`,
        detail: `${line.obligationTitle} · ${line.code} is recurring but cannot generate its next occurrence until the schedule is completed.`,
        href: `/admin/corporate/obligations/${line.obligationId}/lines`,
      });
    }
    if (line.overdueDueCount > 0) {
      signals.push({
        id: `line-overdue:${line.id}`,
        severity: "ACTION",
        title: `${line.name} has ${line.overdueDueCount} overdue due item${line.overdueDueCount === 1 ? "" : "s"}`,
        detail: `${line.obligationTitle} · review invoice, dispute and payment workflow state.`,
        href: `/admin/corporate/obligations/${line.obligationId}`,
      });
    }
  }

  return signals.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "ACTION" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Canonical status codes are for the database, exports and audit rows. They are not
 * for operators. This module is the single place a code becomes a sentence — the
 * same job `lib/status-display.ts` does for Hiring, which Corporate never adopted.
 *
 * It previously rendered `status.replaceAll("_", " ")`, so every screen shouted
 * "NOT PAID" and "IN PROGRESS" at the reader all day.
 *
 * Colour is never the only signal: the label is always real words (WCAG 2.2 AA).
 * Tones follow D17 — Executive Navy and Governance Teal carry operational meaning,
 * red is reserved for things genuinely wrong, and Compass Gold appears nowhere.
 */

export type CorporateTone =
	/** Nothing is being asked of you. */
	| "neutral"
	/** Live and unremarkable. */
	| "info"
	/** Moving through the workflow as intended. */
	| "progress"
	/** Finished well. */
	| "ready"
	/** Needs a person soon, but nothing has gone wrong. */
	| "attention"
	/** Something is wrong or late. */
	| "critical"
	/** An administrative dead end — closed, voided, cancelled. Not an error. */
	| "exception";

const TONE: Record<CorporateTone, string> = {
	neutral: "border-border bg-transparent text-muted-foreground",
	info: "border-transparent bg-secondary text-secondary-foreground",
	progress: "border-transparent bg-progress/12 text-progress",
	ready: "border-transparent bg-progress text-progress-foreground",
	attention: "border-transparent bg-primary/10 text-primary",
	critical: "border-transparent bg-destructive/10 text-destructive",
	// Distinguished by border style rather than another colour, so a closed record
	// reads as an administrative fact and red stays meaningful.
	exception: "border-dashed border-border bg-transparent text-muted-foreground",
};

type Display = { label: string; tone: CorporateTone };

/**
 * One map across every Corporate enum family. Tokens shared between families
 * (OPEN, COMPLETED, CANCELLED) genuinely mean the same thing to a reader in each
 * context, so they are deliberately not disambiguated by an extra `kind` prop —
 * that would force a change at every call site to say something no operator needs.
 */
const DISPLAY: Record<string, Display> = {
	// Obligation lifecycle. ACTIVE is the majority of the register, so it is a tint
	// rather than a solid fill — the eye needs the exceptions to stand out, not the norm.
	DRAFT: { label: "Draft", tone: "neutral" },
	ACTIVE: { label: "Active", tone: "progress" },
	ENDED: { label: "Ended", tone: "exception" },
	CANCELLED: { label: "Cancelled", tone: "exception" },

	// Attention state, derived from due dates at read time — never stored.
	OVERDUE: { label: "Overdue", tone: "critical" },
	DUE: { label: "Due now", tone: "attention" },
	UPCOMING: { label: "Upcoming", tone: "neutral" },

	// Due items.
	OPEN: { label: "Open", tone: "info" },
	COMPLETED: { label: "Completed", tone: "progress" },

	// Payment approval.
	PENDING: { label: "Awaiting approval", tone: "attention" },
	APPROVED: { label: "Approved", tone: "progress" },
	REJECTED: { label: "Rejected", tone: "critical" },

	// Payment settlement.
	NOT_PAID: { label: "Not paid", tone: "neutral" },
	PARTIALLY_PAID: { label: "Part paid", tone: "attention" },
	PAID: { label: "Paid", tone: "progress" },
	VOIDED: { label: "Voided", tone: "exception" },
	RECONCILED: { label: "Reconciled", tone: "ready" },

	// Work items.
	ACKNOWLEDGED: { label: "Acknowledged", tone: "info" },
	IN_PROGRESS: { label: "In progress", tone: "progress" },
	RESOLVED: { label: "Resolved", tone: "ready" },

	// Work-item priority.
	LOW: { label: "Low", tone: "neutral" },
	NORMAL: { label: "Normal", tone: "neutral" },
	HIGH: { label: "High", tone: "attention" },
	CRITICAL: { label: "Critical", tone: "critical" },

	// Closure and reconciliation.
	RECONCILING: { label: "Reconciling", tone: "progress" },
	READY: { label: "Ready to close", tone: "attention" },
	CLOSED: { label: "Closed", tone: "exception" },
	SETTLED: { label: "Settled", tone: "progress" },
	WAIVED: { label: "Waived", tone: "exception" },
	DISPUTED: { label: "Disputed", tone: "critical" },

	// Scheduled automation.
	RUNNING: { label: "Running", tone: "progress" },
	PARTIAL: { label: "Partly delivered", tone: "attention" },
	FAILED: { label: "Failed", tone: "critical" },
	SKIPPED: { label: "Skipped", tone: "neutral" },

	// Reminder delivery.
	QUEUED: { label: "Queued", tone: "neutral" },
	SENT: { label: "Sent", tone: "progress" },
	BLOCKED: { label: "Blocked", tone: "critical" },
	IN_APP: { label: "In-app", tone: "neutral" },
	EMAIL: { label: "Email", tone: "neutral" },

	// Data-quality findings stay descriptive: words an operator can act on, never a
	// numeric index and never an ordered "worst first" list (AGENTS.md).
	ACTION: { label: "Needs action", tone: "attention" },
	REVIEW: { label: "Worth reviewing", tone: "neutral" },
};

/** `PARTIALLY_PAID` → `Partially paid`. Only reached for tokens not in the map. */
function titleCase(token: string): string {
	const words = token.replaceAll("_", " ").toLowerCase().trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function corporateStatusDisplay(status: string): Display {
	return DISPLAY[status] ?? { label: titleCase(status), tone: "neutral" };
}

/**
 * Plain label, for table cells and sentences that are not badges. Also the
 * replacement for the `.replaceAll("_", " ")` that was scattered across 37 call
 * sites — that left `LANDLORD` untouched and turned `DATA_QUALITY` into
 * `DATA QUALITY`, so codes reached the reader either way.
 *
 * Nullish in, nullish out, so it drops into the `x?.replaceAll(...) ?? "—"`
 * shape those call sites already used.
 */
export function corporateStatusLabel(status: string): string;
export function corporateStatusLabel(status: string | null | undefined): string | undefined;
export function corporateStatusLabel(status: string | null | undefined): string | undefined {
	if (status == null) return undefined;
	return corporateStatusDisplay(status).label;
}

export function CorporateStatusBadge({
	status,
	className,
}: {
	status: string;
	className?: string;
}) {
	const { label, tone } = corporateStatusDisplay(status);
	return (
		<Badge variant="outline" className={cn(TONE[tone], className)}>
			{label}
		</Badge>
	);
}

export function formatMoney(currency: string, amount: number | null | undefined): string {
  if (amount == null) return "—";
  try { return new Intl.NumberFormat("en-MY", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export function todayDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

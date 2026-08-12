import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  ACTIVE: "border-transparent bg-primary/10 text-primary",
  COMPLETED: "border-transparent bg-primary/10 text-primary",
  PAID: "border-transparent bg-primary/10 text-primary",
  APPROVED: "border-transparent bg-primary/10 text-primary",
  RECONCILED: "border-transparent bg-primary/10 text-primary",
  DUE: "border-transparent bg-secondary text-secondary-foreground",
  PARTIALLY_PAID: "border-transparent bg-secondary text-secondary-foreground",
  OVERDUE: "border-transparent bg-destructive/10 text-destructive",
  REJECTED: "border-transparent bg-destructive/10 text-destructive",
  DISPUTED: "border-transparent bg-destructive/10 text-destructive",
  VOIDED: "border-dashed text-muted-foreground",
  CANCELLED: "border-dashed text-muted-foreground",
  ENDED: "border-dashed text-muted-foreground",
  DRAFT: "bg-transparent text-muted-foreground",
  OPEN: "bg-transparent text-foreground",
  UPCOMING: "bg-transparent text-muted-foreground",
  PENDING: "bg-transparent text-foreground",
  NOT_PAID: "bg-transparent text-muted-foreground",
};

export function CorporateStatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn(tone[status] ?? "bg-transparent")}>{status.replaceAll("_", " ")}</Badge>;
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

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusDisplay, type StatusTone } from "@/lib/status-display";

/**
 * The label is real text, never colour alone — WCAG 2.2 AA and requirements §16.
 * "ready" is Governance Teal because it is operational progress: a profile is waiting
 * for a reviewer. It is never a judgement about the candidate.
 */
const TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-transparent text-muted-foreground",
  info: "border-transparent bg-secondary text-secondary-foreground",
  progress: "border-transparent bg-progress/12 text-progress",
  ready: "border-transparent bg-progress text-progress-foreground",
  // Distinguished by border style rather than another colour, so exceptions read as
  // administrative facts and the palette keeps red for genuinely destructive things.
  exception: "border-dashed border-border bg-transparent text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { label, tone } = statusDisplay(status);
  return (
    <Badge variant="outline" className={cn(TONE[tone], className)}>
      {label}
    </Badge>
  );
}

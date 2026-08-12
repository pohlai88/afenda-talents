import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type AfendaWorkflowStep = {
  label: string;
  description?: string;
  state: "complete" | "current" | "upcoming";
};

export function AfendaWorkflowStepper({ steps, className }: { steps: AfendaWorkflowStep[]; className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", className)}>
      {steps.map((step, index) => (
        <li key={`${index}-${step.label}`} className="relative min-w-0">
          <div
            className={cn(
              "flex h-full gap-3 rounded-lg border p-3",
              step.state === "current" && "border-primary/40 bg-primary/[0.035]",
              step.state === "complete" && "bg-muted/35",
            )}
          >
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold",
                step.state === "complete" && "border-primary bg-primary text-primary-foreground",
                step.state === "current" && "border-primary text-primary",
                step.state === "upcoming" && "text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {step.state === "complete" ? <Check className="size-3.5" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", step.state === "upcoming" && "text-muted-foreground")}>{step.label}</p>
              {step.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

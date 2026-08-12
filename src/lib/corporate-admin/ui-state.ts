import type { AfendaReadinessItem } from "@/components/afenda/readiness-checklist";
import type { ObligationStatus } from "@/lib/corporate-admin/domain";

export type ObligationUiInput = {
  status: ObligationStatus;
  counterpartyActive: boolean;
  startDate: string;
  currency: string;
  ownerAssigned: boolean;
  recurring: boolean;
  recurrenceInterval: number | null;
  recurrenceUnit: string | null;
  nextDueDate: string | null;
  contractRequired: boolean;
  contractFileUrl: string | null;
  requiredCustomFields: Array<{ key: string; label: string }>;
  customFields: Record<string, unknown>;
  overdueDueItems: number;
  pendingApprovals: number;
  unreconciledPayments: number;
};

export type ObligationNextAction = {
  action: string;
  why: string;
  who: string;
  tone: "default" | "attention" | "complete";
};

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function obligationReadiness(input: ObligationUiInput): AfendaReadinessItem[] {
  const recurrenceReady = !input.recurring || Boolean(input.recurrenceInterval && input.recurrenceUnit && input.nextDueDate);
  const contractReady = !input.contractRequired || Boolean(input.contractFileUrl);
  const customReady = input.requiredCustomFields.every((field) => hasValue(input.customFields[field.key]));

  const items: AfendaReadinessItem[] = [
    {
      label: "Active counterparty",
      state: input.counterpartyActive ? "ready" : "attention",
      detail: input.counterpartyActive ? "The linked counterparty is active." : "Choose or reactivate an active counterparty before continuing.",
    },
    {
      label: "Start date",
      state: input.startDate ? "ready" : "attention",
      detail: input.startDate ? `Starts ${input.startDate}.` : "A start date is required.",
    },
    {
      label: "Currency",
      state: input.currency ? "ready" : "attention",
      detail: input.currency ? `Amounts use ${input.currency}.` : "Choose the obligation currency.",
    },
    {
      label: "Recurrence schedule",
      state: recurrenceReady ? "ready" : "attention",
      detail: input.recurring
        ? recurrenceReady
          ? "Interval, unit and next due date are complete."
          : "Recurring obligations require interval, unit and next due date before activation."
        : "This is a valid one-off/manual obligation.",
    },
    {
      label: "Contract evidence",
      state: input.contractRequired ? (contractReady ? "ready" : "attention") : "optional",
      detail: input.contractRequired
        ? contractReady
          ? "Required contract link is present."
          : "A contract link is required before activation."
        : "Contract evidence is not mandatory for this record.",
    },
  ];

  if (input.requiredCustomFields.length > 0) {
    items.push({
      label: "Required custom fields",
      state: customReady ? "ready" : "attention",
      detail: customReady
        ? `${input.requiredCustomFields.length} required custom field${input.requiredCustomFields.length === 1 ? " is" : "s are"} complete.`
        : `Complete: ${input.requiredCustomFields.filter((field) => !hasValue(input.customFields[field.key])).map((field) => field.label).join(", ")}.`,
    });
  }

  items.push({
    label: "Record owner",
    state: input.ownerAssigned ? "ready" : "optional",
    detail: input.ownerAssigned ? "An accountable owner is assigned." : "Assign an owner when ongoing follow-up responsibility needs to be explicit.",
  });

  return items;
}

export function obligationCanActivate(input: ObligationUiInput): boolean {
  return obligationReadiness(input).every((item) => item.state !== "attention");
}

export function obligationNextAction(input: ObligationUiInput): ObligationNextAction {
  if (input.status === "CANCELLED") {
    return {
      action: "No further action is scheduled for this cancelled obligation.",
      why: "The record remains available for history and audit, but its lifecycle is closed.",
      who: "Record viewers",
      tone: "complete",
    };
  }
  if (input.status === "ENDED") {
    return {
      action: input.unreconciledPayments > 0 ? "Finish reconciling recorded payments." : "Keep the ended obligation for reference and audit history.",
      why: input.unreconciledPayments > 0 ? "Settlement evidence is recorded but reconciliation is still incomplete." : "The commercial obligation has ended and no new scheduled dues should be generated.",
      who: input.unreconciledPayments > 0 ? "Administrator / finance reviewer" : "Record viewers",
      tone: input.unreconciledPayments > 0 ? "attention" : "complete",
    };
  }
  if (input.status === "DRAFT") {
    if (!obligationCanActivate(input)) {
      return {
        action: "Complete the readiness items that need attention, then activate the obligation.",
        why: "Activation should succeed only when the same required conditions enforced by the server are satisfied.",
        who: "Corporate administrator",
        tone: "attention",
      };
    }
    return {
      action: "Review the record and activate the obligation.",
      why: "Activation makes the obligation operational so due items and payment activity can begin.",
      who: "Corporate administrator",
      tone: "default",
    };
  }
  if (input.overdueDueItems > 0) {
    return {
      action: `Review ${input.overdueDueItems} overdue due item${input.overdueDueItems === 1 ? "" : "s"} and resolve the invoice or payment position.`,
      why: "Overdue items are the most time-sensitive operational exception on this obligation.",
      who: "Obligation owner / corporate administrator",
      tone: "attention",
    };
  }
  if (input.pendingApprovals > 0) {
    return {
      action: `Review ${input.pendingApprovals} pending payment approval${input.pendingApprovals === 1 ? "" : "s"}.`,
      why: "Requested payments cannot move to settlement until an authorised approval decision is recorded.",
      who: "Corporate administrator / approver",
      tone: "default",
    };
  }
  if (input.unreconciledPayments > 0) {
    return {
      action: `Reconcile ${input.unreconciledPayments} recorded payment${input.unreconciledPayments === 1 ? "" : "s"}.`,
      why: "Payment has been recorded, but the final post-payment verification step is still open.",
      who: "Corporate administrator / finance reviewer",
      tone: "default",
    };
  }
  if (input.recurring && input.nextDueDate) {
    return {
      action: `Generate the next scheduled due item for ${input.nextDueDate}.`,
      why: "The recurrence pointer identifies the next occurrence that has not yet been materialised into a due item.",
      who: "Obligation owner / corporate administrator",
      tone: "default",
    };
  }
  return {
    action: "Add a due item when the next one-off charge, invoice or exceptional amount becomes due.",
    why: "This obligation does not currently have another scheduled recurrence to generate automatically.",
    who: "Obligation owner / corporate administrator",
    tone: "default",
  };
}

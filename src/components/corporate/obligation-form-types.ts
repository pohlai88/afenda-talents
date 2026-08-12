export type CorporateOption = { id: string; label: string; currency?: string | null };

export type ObligationDraft = {
  code: string;
  organization: string;
  category: string;
  title: string;
  counterpartyId: string;
  assetReference: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  recurring: boolean;
  recurrenceInterval: string;
  recurrenceUnit: "DAY" | "WEEK" | "MONTH" | "YEAR";
  expectedAmount: string;
  currency: string;
  firstDueDate: string;
  nextDueDate: string;
  autoRenew: boolean;
  renewalDate: string;
  noticeDays: string;
  contractRequired: boolean;
  contractReference: string;
  contractFileUrl: string;
  paymentMethod: string;
  notes: string;
  customFields: Record<string, unknown>;
};

export const EMPTY_OBLIGATION_DRAFT: ObligationDraft = {
  code: "",
  organization: "",
  category: "TENANCY",
  title: "",
  counterpartyId: "",
  assetReference: "",
  ownerId: "",
  startDate: "",
  endDate: "",
  recurring: false,
  recurrenceInterval: "1",
  recurrenceUnit: "MONTH",
  expectedAmount: "",
  currency: "MYR",
  firstDueDate: "",
  nextDueDate: "",
  autoRenew: false,
  renewalDate: "",
  noticeDays: "",
  contractRequired: false,
  contractReference: "",
  contractFileUrl: "",
  paymentMethod: "BANK_TRANSFER",
  notes: "",
  customFields: {},
};

export type PaymentDto = {
  id: string;
  requestedAmount: number;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  approvedAmount: number | null;
  paymentStatus: "NOT_PAID" | "PARTIALLY_PAID" | "PAID" | "VOIDED";
  paidAmount: number | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  reconciledAt: string | null;
  notes: string | null;
  customFields: Record<string, unknown>;
  recordOrigin: "WORKFLOW" | "HISTORICAL_MANUAL" | "HISTORICAL_IMPORT";
  approvalRequired: boolean;
};

export type DueItemDto = {
  id: string;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number | null;
  invoiceAmount: number | null;
  currency: string;
  invoiceRequired: boolean;
  invoiceNumber: string | null;
  invoiceFileUrl: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  disputeFlag: boolean;
  notes: string | null;
  customFields: Record<string, unknown>;
  payments: PaymentDto[];
};

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaResponsiveDataView } from "@/components/afenda/responsive-data-view";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import { CorporateStatusBadge, formatMoney } from "@/components/corporate/status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type PaymentRegisterRow = {
  id: string;
  requestDate: string;
  obligationId: string;
  obligationTitle: string;
  periodLabel: string;
  counterpartyName: string;
  currency: string;
  requestedAmount: number;
  approvalStatus: string;
  paymentStatus: string;
  reconciled: boolean;
  actorName: string | null;
};

type ApprovalFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type PaymentFilter = "ALL" | "NOT_PAID" | "PARTIALLY_PAID" | "PAID" | "VOIDED";
type ReconciliationFilter = "ALL" | "PENDING" | "RECONCILED";

export function PaymentRegister({ rows }: { rows: PaymentRegisterRow[] }) {
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [reconciliationFilter, setReconciliationFilter] = useState<ReconciliationFilter>("ALL");

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || [row.obligationTitle, row.periodLabel, row.counterpartyName, row.actorName ?? "", row.requestDate].some((value) => value.toLowerCase().includes(query));
      const matchesApproval = approvalFilter === "ALL" || row.approvalStatus === approvalFilter;
      const matchesPayment = paymentFilter === "ALL" || row.paymentStatus === paymentFilter;
      const matchesReconciliation = reconciliationFilter === "ALL" || (reconciliationFilter === "RECONCILED" ? row.reconciled : !row.reconciled);
      return matchesSearch && matchesApproval && matchesPayment && matchesReconciliation;
    });
  }, [approvalFilter, paymentFilter, reconciliationFilter, rows, search]);

  const hasFilters = search.trim() !== "" || approvalFilter !== "ALL" || paymentFilter !== "ALL" || reconciliationFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setApprovalFilter("ALL");
    setPaymentFilter("ALL");
    setReconciliationFilter("ALL");
  }

  const desktop = (
    <Table>
      <TableHeader><TableRow><TableHead>Requested</TableHead><TableHead>Obligation / period</TableHead><TableHead>Requested amount</TableHead><TableHead>Approval</TableHead><TableHead>Payment</TableHead><TableHead>Reconciliation</TableHead><TableHead>Actor</TableHead></TableRow></TableHeader>
      <TableBody>
        {filteredRows.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="text-sm tabular-nums">{payment.requestDate}</TableCell>
            <TableCell><Link href={`/admin/corporate/obligations/${payment.obligationId}`} className="font-medium underline-offset-4 hover:underline">{payment.obligationTitle}</Link><p className="text-xs text-muted-foreground">{payment.periodLabel} · {payment.counterpartyName}</p></TableCell>
            <TableCell className="font-medium tabular-nums">{formatMoney(payment.currency, payment.requestedAmount)}</TableCell>
            <TableCell><CorporateStatusBadge status={payment.approvalStatus} /></TableCell>
            <TableCell><CorporateStatusBadge status={payment.paymentStatus} /></TableCell>
            <TableCell>{payment.reconciled ? <CorporateStatusBadge status="RECONCILED" /> : <span className="text-sm text-muted-foreground">Pending</span>}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{payment.actorName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const mobile = (
    <ul className="flex flex-col gap-3">
      {filteredRows.map((payment) => (
        <li key={payment.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div><Link href={`/admin/corporate/obligations/${payment.obligationId}`} className="font-medium underline-offset-4 hover:underline">{payment.obligationTitle}</Link><p className="text-xs text-muted-foreground">{payment.periodLabel} · {payment.requestDate}</p></div>
            <p className="font-medium tabular-nums">{formatMoney(payment.currency, payment.requestedAmount)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><CorporateStatusBadge status={payment.approvalStatus} /><CorporateStatusBadge status={payment.paymentStatus} />{payment.reconciled ? <CorporateStatusBadge status="RECONCILED" /> : null}</div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search payments…" resultCount={filteredRows.length}>
        <AfendaSelectFilter
          ariaLabel="Filter payments by approval status"
          value={approvalFilter}
          onValueChange={(value) => setApprovalFilter(value as ApprovalFilter)}
          options={[
            { value: "ALL", label: "All approvals" },
            { value: "PENDING", label: "Pending approval" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
        <AfendaSelectFilter
          ariaLabel="Filter payments by settlement status"
          value={paymentFilter}
          onValueChange={(value) => setPaymentFilter(value as PaymentFilter)}
          options={[
            { value: "ALL", label: "All settlements" },
            { value: "NOT_PAID", label: "Not paid" },
            { value: "PARTIALLY_PAID", label: "Partially paid" },
            { value: "PAID", label: "Paid" },
            { value: "VOIDED", label: "Voided" },
          ]}
        />
        <AfendaSelectFilter
          ariaLabel="Filter payments by reconciliation"
          value={reconciliationFilter}
          onValueChange={(value) => setReconciliationFilter(value as ReconciliationFilter)}
          options={[
            { value: "ALL", label: "All reconciliation" },
            { value: "PENDING", label: "Pending reconciliation" },
            { value: "RECONCILED", label: "Reconciled" },
          ]}
        />
        {hasFilters ? <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button> : null}
      </AfendaFilterToolbar>
      {filteredRows.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No payments match the current filters.</p> : <AfendaResponsiveDataView desktop={desktop} mobile={mobile} />}
    </div>
  );
}

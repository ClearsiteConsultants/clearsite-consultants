export type BillingStatus = "paid" | "partially_paid" | "overdue" | "pending";

export type BillingInvoice = {
  invoiceTotal: number;
  amountPaid: number;
  dueDate: string | Date | null;
  qboSyncStatus: string | null;
  paidAt: string | Date | null;
};

export type BillingSummary = {
  totalPaid: number;
  outstandingBalance: number;
  overdueCount: number;
  pendingCount: number;
};

function calendarDate(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  return value?.trim().slice(0, 10) || null;
}

export function getBillingStatus(
  invoice: BillingInvoice,
  today = new Date()
): BillingStatus {
  const total = Math.max(Number(invoice.invoiceTotal) || 0, 0);
  const paid = Math.max(Number(invoice.amountPaid) || 0, 0);
  const qboStatus = (invoice.qboSyncStatus || "").trim().toLowerCase();

  if (invoice.paidAt || qboStatus === "paid" || (total > 0 && paid >= total)) {
    return "paid";
  }

  if (paid > 0) {
    return "partially_paid";
  }

  const dueDate = calendarDate(invoice.dueDate);
  const todayDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (dueDate && dueDate < todayDate) {
    return "overdue";
  }

  return "pending";
}

export function buildBillingSummary(
  invoices: BillingInvoice[],
  today = new Date()
): BillingSummary {
  return invoices.reduce<BillingSummary>(
    (summary, invoice) => {
      const total = Math.max(Number(invoice.invoiceTotal) || 0, 0);
      const recordedPaid = Math.max(Number(invoice.amountPaid) || 0, 0);
      const status = getBillingStatus(invoice, today);
      const paidAmount = status === "paid" && recordedPaid === 0
        ? total
        : Math.min(recordedPaid, total);

      summary.totalPaid += paidAmount;
      summary.outstandingBalance += Math.max(total - paidAmount, 0);

      if (status === "overdue") summary.overdueCount += 1;
      if (status === "pending" || status === "partially_paid") {
        summary.pendingCount += 1;
      }

      return summary;
    },
    {
      totalPaid: 0,
      outstandingBalance: 0,
      overdueCount: 0,
      pendingCount: 0,
    }
  );
}

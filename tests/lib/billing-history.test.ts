import { describe, expect, it } from "vitest";
import {
  buildBillingSummary,
  getBillingStatus,
  type BillingInvoice,
} from "@/lib/billing-history";

const today = new Date(2026, 6, 28);

function invoice(overrides: Partial<BillingInvoice> = {}): BillingInvoice {
  return {
    invoiceTotal: 100,
    amountPaid: 0,
    dueDate: "2026-08-15",
    qboSyncStatus: "sent",
    paidAt: null,
    ...overrides,
  };
}

describe("billing history", () => {
  it("derives paid, partial, overdue, and pending statuses", () => {
    expect(getBillingStatus(invoice({ qboSyncStatus: "paid" }), today)).toBe("paid");
    expect(getBillingStatus(invoice({ amountPaid: 25 }), today)).toBe("partially_paid");
    expect(getBillingStatus(invoice({ dueDate: "2026-07-01" }), today)).toBe("overdue");
    expect(getBillingStatus(invoice({ dueDate: new Date("2026-07-01T00:00:00.000Z") }), today)).toBe("overdue");
    expect(getBillingStatus(invoice(), today)).toBe("pending");
  });

  it("builds paid and outstanding summary totals", () => {
    const summary = buildBillingSummary(
      [
        invoice({ qboSyncStatus: "paid", amountPaid: 100 }),
        invoice({ amountPaid: 25 }),
        invoice({ invoiceTotal: 50, dueDate: "2026-07-01" }),
      ],
      today
    );

    expect(summary).toEqual({
      totalPaid: 125,
      outstandingBalance: 125,
      overdueCount: 1,
      pendingCount: 1,
    });
  });

  it("counts a paid invoice total when QuickBooks reports paid without amount_paid", () => {
    const summary = buildBillingSummary(
      [invoice({ invoiceTotal: 250, qboSyncStatus: "paid", amountPaid: 0 })],
      today
    );

    expect(summary.totalPaid).toBe(250);
    expect(summary.outstandingBalance).toBe(0);
  });
});

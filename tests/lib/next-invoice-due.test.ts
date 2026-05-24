import { beforeEach, describe, expect, it, vi } from "vitest";

type InvoiceRow = {
  id: string;
  client_id: string;
  due_date: string;
  qbo_sync_status: string | null;
  paid_at: string | null;
  created_order: number;
  qbo_invoice_id: string | null;
  qbo_doc_number: string | null;
  qbo_payment_url: string | null;
  invoice_date: string | null;
  invoice_total: number;
  amount_paid: number;
  is_manual_link: boolean;
};

const harness = vi.hoisted(() => {
  const state = {
    invoices: [] as InvoiceRow[],
    clients: new Map<string, { id: string; next_invoice_due: string | null }>(),
    invoiceIdCounter: 1,
    createdOrder: 1,
  };

  const reset = () => {
    state.invoices = [];
    state.clients = new Map();
    state.invoiceIdCounter = 1;
    state.createdOrder = 1;
  };

  const dbMock = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sqlText = strings.join(" ").replace(/\s+/g, " ").trim();

    if (sqlText.includes("INSERT INTO invoices")) {
      const invoice: InvoiceRow = {
        id: `inv-${state.invoiceIdCounter++}`,
        client_id: String(values[0]),
        invoice_date: values[2] ? String(values[2]) : null,
        due_date: String(values[3]),
        invoice_total: Number(values[4]),
        qbo_payment_url: values[5] ? String(values[5]) : null,
        qbo_invoice_id: values[6] ? String(values[6]) : null,
        qbo_doc_number: values[7] ? String(values[7]) : null,
        qbo_sync_status: values[8] ? String(values[8]) : "pending",
        amount_paid: Number(values[9] ?? 0),
        paid_at: values[10] ? String(values[10]) : null,
        is_manual_link: Boolean(values[11]),
        created_order: state.createdOrder++,
      };

      state.invoices.push(invoice);
      return [invoice];
    }

    if (sqlText.includes("UPDATE invoices") && sqlText.includes("WHERE qbo_invoice_id =")) {
      const qboInvoiceId = String(values[7]);
      const invoice = state.invoices.find((row) => row.qbo_invoice_id === qboInvoiceId);
      if (!invoice) return [];

      invoice.qbo_sync_status = String(values[0]);
      if (values[1] != null) invoice.amount_paid = Number(values[1]);
      if (values[2] != null) invoice.paid_at = String(values[2]);
      if (values[3] != null) invoice.qbo_payment_url = String(values[3]);
      if (values[4] != null) invoice.qbo_doc_number = String(values[4]);
      if (values[5] != null) invoice.invoice_date = String(values[5]);
      if (values[6] != null) invoice.invoice_total = Number(values[6]);

      return [invoice];
    }

    if (sqlText.includes("UPDATE invoices") && sqlText.includes("WHERE id =")) {
      const invoiceId = String(values[12]);
      const invoice = state.invoices.find((row) => row.id === invoiceId);
      if (!invoice) return [];

      if (values[0] != null) invoice.qbo_invoice_id = String(values[0]);
      if (values[1] != null) invoice.qbo_doc_number = String(values[1]);
      if (values[2] != null) invoice.qbo_payment_url = String(values[2]);
      invoice.qbo_sync_status = String(values[3]);
      if (values[4] != null) invoice.amount_paid = Number(values[4]);
      if (values[5] != null) invoice.paid_at = String(values[5]);
      if (values[6] != null) invoice.invoice_date = String(values[6]);
      if (values[7] != null) invoice.invoice_total = Number(values[7]);

      return [invoice];
    }

    if (sqlText.includes("UPDATE clients") && sqlText.includes("next_invoice_due = (")) {
      const clientId = String(values[0]);
      const nextDue = state.invoices
        .filter((row) => {
          const status = (row.qbo_sync_status ?? "pending").toLowerCase();
          return row.client_id === clientId && row.paid_at == null && status !== "paid";
        })
        .sort((a, b) => {
          if (a.due_date === b.due_date) {
            return a.created_order - b.created_order;
          }
          return a.due_date < b.due_date ? -1 : 1;
        })[0]?.due_date ?? null;

      const client = { id: clientId, next_invoice_due: nextDue };
      state.clients.set(clientId, client);
      return [client];
    }

    return [];
  });

  const postgresFactoryMock = vi.fn(() => dbMock);

  return {
    state,
    reset,
    dbMock,
    postgresFactoryMock,
  };
});

vi.mock("postgres", () => ({
  default: harness.postgresFactoryMock,
}));

import {
  createInvoice,
  updateInvoiceQuickBooksData,
  updateInvoiceStatusByQuickBooksInvoiceId,
} from "@/lib/db";

describe("lib/db next invoice due recomputation", () => {
  beforeEach(() => {
    harness.reset();
    vi.clearAllMocks();
  });

  it("picks the earliest unpaid due date when a later invoice is followed by an earlier invoice", async () => {
    await createInvoice({
      client_id: "client-1",
      invoice_total: 200,
      due_date: "2026-08-20",
      qbo_sync_status: "sent",
    });

    expect(harness.state.clients.get("client-1")?.next_invoice_due).toBe("2026-08-20");

    await createInvoice({
      client_id: "client-1",
      invoice_total: 150,
      due_date: "2026-07-10",
      qbo_sync_status: "sent",
    });

    expect(harness.state.clients.get("client-1")?.next_invoice_due).toBe("2026-07-10");
  });

  it("sets next_invoice_due to null when the last unpaid linked invoice becomes paid", async () => {
    await createInvoice({
      client_id: "client-2",
      invoice_total: 100,
      due_date: "2026-09-15",
      qbo_invoice_id: "qbo-2",
      qbo_sync_status: "sent",
      paid_at: null,
    });

    await updateInvoiceStatusByQuickBooksInvoiceId({
      qboInvoiceId: "qbo-2",
      qboSyncStatus: "paid",
      amountPaid: 100,
      paidAt: "2026-09-16",
    });

    expect(harness.state.clients.get("client-2")?.next_invoice_due).toBeNull();
  });

  it("refreshes next_invoice_due for manual-link creation and QBO sync/status updates", async () => {
    const manualLinked = await createInvoice({
      client_id: "client-3",
      invoice_total: 220,
      due_date: "2026-10-01",
      qbo_invoice_id: "qbo-3",
      qbo_doc_number: "INV-3",
      qbo_sync_status: "sent",
      is_manual_link: true,
    });

    expect(harness.state.clients.get("client-3")?.next_invoice_due).toBe("2026-10-01");

    await updateInvoiceQuickBooksData({
      invoiceId: String(manualLinked.id),
      qboInvoiceId: "qbo-3",
      qboDocNumber: "INV-3",
      qboSyncStatus: "paid",
      amountPaid: 220,
      paidAt: "2026-10-02",
      qboPaymentUrl: "https://pay.example/inv-3",
    });

    expect(harness.state.clients.get("client-3")?.next_invoice_due).toBeNull();
  });
});

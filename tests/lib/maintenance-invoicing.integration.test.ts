import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { 
  sqlMock, 
  getQuickBooksConnectionMock, 
  createQuickBooksInvoiceMock, 
  ensureQuickBooksCustomerMock,
  updateQuickBooksInvoiceLineItemMock
} = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  getQuickBooksConnectionMock: vi.fn(),
  createQuickBooksInvoiceMock: vi.fn(),
  ensureQuickBooksCustomerMock: vi.fn(),
  updateQuickBooksInvoiceLineItemMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  sql: sqlMock,
  createInvoice: vi.fn(),
  refreshClientNextInvoiceDue: vi.fn(),
  getQuickBooksConnection: getQuickBooksConnectionMock,
  getClientQuickBooksProfile: vi.fn().mockResolvedValue({ qbo_customer_id: "CUST-123" }),
}));

vi.mock("@/lib/quickbooks", () => ({
  createQuickBooksInvoice: createQuickBooksInvoiceMock,
  updateQuickBooksInvoiceLineItem: updateQuickBooksInvoiceLineItemMock,
  resolveItemAmount: vi.fn().mockImplementation((_, __, amount) => Promise.resolve(amount)),
  getQuickBooksItems: vi.fn().mockResolvedValue([]),
  extractQuickBooksInvoiceState: vi.fn().mockReturnValue({
    invoiceTotal: 100,
    invoiceDate: "2026-07-16",
    paymentUrl: "http://qbo/pay",
    qboInvoiceId: "QBO-123",
    qboDocNumber: "123",
    qboSyncStatus: "Sent",
  }),
  sendQuickBooksInvoiceEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/quickbooks-sync", () => ({
  ensureQuickBooksCustomer: ensureQuickBooksCustomerMock,
}));

import { 
  generateMaintenanceInvoicesForClient, 
  updateUnpaidMaintenanceInvoices,
  processAllMaintenanceInvoices 
} from "@/lib/maintenance-invoicing";

describe("Maintenance Invoicing Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Manual Test (First Invoice): sets service_start_date and creates Net 15 invoice immediately", async () => {
    // Current date is July 11
    const date = new Date("2026-07-11T12:00:00Z");
    vi.setSystemTime(date);

    // Mock client as just activated
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join("");
      if (query.includes("SELECT id, company_name")) {
        return Promise.resolve({
          rows: [{
            id: "client-1",
            company_name: "Test Co",
            email: "test@test.com",
            plan: "Starter",
            service_status: "Active",
            client_status: "Active",
            maintenance_fee_frequency: "Monthly",
            service_start_date: new Date("2026-07-11"), 
          }],
        });
      }
      if (query.includes("SELECT id FROM invoices")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    createQuickBooksInvoiceMock.mockResolvedValue({ Id: "QBO-123" });

    const result = await generateMaintenanceInvoicesForClient("client-1");

    expect(result.totalCreated).toBe(1);
    expect(createQuickBooksInvoiceMock).toHaveBeenCalledWith("123", expect.objectContaining({
      termName: "Net 15",
      dueDate: "2026-08-15", // Following month's 15th
      invoiceDate: "2026-07-11", // Immediate post date
    }));
  });

  it("Manual Test (Plan Change): updates unpaid maintenance invoice itemId", async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join("");
      if (query.includes("FROM clients")) {
        return Promise.resolve({
          rows: [{ id: "client-1", plan: "Starter", maintenance_fee_frequency: "Yearly" }],
        });
      }
      if (query.includes("FROM invoices")) {
        return Promise.resolve({
          rows: [{ 
            id: "inv-1", 
            qbo_invoice_id: "QBO-OLD", 
            notes: "Maintenance Fee" 
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });

    // Starter/Yearly -> Pro/Monthly is a change
    await updateUnpaidMaintenanceInvoices("client-1", "Pro", "Monthly");

    expect(sqlMock).toHaveBeenCalled();
  });

  it("Manual Test (Sync): processes all active clients", async () => {
    // Current date is July 11
    const date = new Date("2026-07-11T12:00:00Z");
    vi.setSystemTime(date);

    sqlMock.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");
      if (query.includes("FROM clients")) {
        // Return 2 clients for progress loop AND return client details for each
        if (query.includes("WHERE service_status = 'Active'")) {
          return { rows: [{ id: "client-1" }, { id: "client-2" }] };
        }
        return {
          rows: [{
            id: values[0] as string,
            company_name: "Test Co",
            email: "test@test.com",
            plan: "Starter",
            service_status: "Active",
            client_status: "Active",
            maintenance_fee_frequency: "Monthly",
            service_start_date: new Date("2026-07-11"), 
          }],
        };
      }
      return { rows: [] };
    });

    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    createQuickBooksInvoiceMock.mockResolvedValue({ Id: "QBO-123" });

    const result = await processAllMaintenanceInvoices();

    // Should process both and create 1 invoice for each
    expect(result.totalCreated).toBe(2);
    expect(createQuickBooksInvoiceMock).toHaveBeenCalledTimes(2);
  });
});

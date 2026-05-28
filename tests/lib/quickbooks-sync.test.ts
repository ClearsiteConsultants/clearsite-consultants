import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getQuickBooksConnectionMock,
  getClientQboInvoiceIdsMock,
  getClientQuickBooksProfileMock,
  getInvoiceByIdMock,
  setClientQuickBooksCustomerIdMock,
  updateInvoiceQuickBooksDataMock,
  updateInvoiceStatusByQuickBooksInvoiceIdMock,
  createQuickBooksCustomerMock,
  createQuickBooksInvoiceMock,
  findQuickBooksCustomerByDisplayNameMock,
  getQuickBooksInvoiceMock,
  getQuickBooksInvoicePdfMock,
  extractQuickBooksInvoiceStateMock,
} = vi.hoisted(() => ({
  getQuickBooksConnectionMock: vi.fn(),
  getClientQboInvoiceIdsMock: vi.fn(),
  getClientQuickBooksProfileMock: vi.fn(),
  getInvoiceByIdMock: vi.fn(),
  setClientQuickBooksCustomerIdMock: vi.fn(),
  updateInvoiceQuickBooksDataMock: vi.fn(),
  updateInvoiceStatusByQuickBooksInvoiceIdMock: vi.fn(),
  createQuickBooksCustomerMock: vi.fn(),
  createQuickBooksInvoiceMock: vi.fn(),
  findQuickBooksCustomerByDisplayNameMock: vi.fn(),
  getQuickBooksInvoiceMock: vi.fn(),
  getQuickBooksInvoicePdfMock: vi.fn(),
  extractQuickBooksInvoiceStateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getClientQboInvoiceIds: getClientQboInvoiceIdsMock,
  getClientQuickBooksProfile: getClientQuickBooksProfileMock,
  getInvoiceById: getInvoiceByIdMock,
  setClientQuickBooksCustomerId: setClientQuickBooksCustomerIdMock,
  updateInvoiceQuickBooksData: updateInvoiceQuickBooksDataMock,
  getQuickBooksConnection: getQuickBooksConnectionMock,
  updateInvoiceStatusByQuickBooksInvoiceId: updateInvoiceStatusByQuickBooksInvoiceIdMock,
  createInvoice: vi.fn(),
  checkDuplicateByQboInvoiceId: vi.fn(),
}));

vi.mock("@/lib/quickbooks", () => ({
  getQuickBooksInvoice: getQuickBooksInvoiceMock,
  extractQuickBooksInvoiceState: extractQuickBooksInvoiceStateMock,
  createQuickBooksCustomer: createQuickBooksCustomerMock,
  createQuickBooksInvoice: createQuickBooksInvoiceMock,
  findQuickBooksCustomerByDisplayName: findQuickBooksCustomerByDisplayNameMock,
  findQuickBooksInvoiceByDocNumber: vi.fn(),
  getQuickBooksInvoicePdf: getQuickBooksInvoicePdfMock,
}));

import { syncClientInvoicesFromQuickBooks, syncInvoiceToQuickBooks } from "@/lib/quickbooks-sync";

describe("lib/quickbooks-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counts when no QuickBooks connection exists", async () => {
    getQuickBooksConnectionMock.mockResolvedValue(null);

    await expect(syncClientInvoicesFromQuickBooks("client-1")).resolves.toEqual({ synced: 0, failed: 0 });
  });

  it("counts failed invoice syncs without throwing", async () => {
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getClientQboInvoiceIdsMock.mockResolvedValue(["1", "2"]);
    getQuickBooksInvoiceMock.mockImplementation((_: string, invoiceId: string) => {
      if (invoiceId === "2") throw new Error("transient");
      return { Id: "1", TotalAmt: 100, Balance: 100 };
    });
    extractQuickBooksInvoiceStateMock.mockReturnValue({
      qboInvoiceId: "1",
      qboDocNumber: "INV-1",
      qboSyncStatus: "sent",
      amountPaid: 0,
      paidAt: null,
      paymentUrl: null,
      invoiceDate: "2025-01-01",
      invoiceTotal: 100,
    });
    updateInvoiceStatusByQuickBooksInvoiceIdMock.mockResolvedValue({});

    await expect(syncClientInvoicesFromQuickBooks("client-1")).resolves.toEqual({ synced: 1, failed: 1 });
  });

  it("uses canonical invoice_total and sends billing address when creating QBO customer", async () => {
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getInvoiceByIdMock.mockResolvedValue({
      id: "inv-1",
      client_id: "client-1",
      qbo_doc_number: "INV-1",
      invoice_total: 150,
      due_date: "2026-01-01",
      invoice_date: "2025-12-01",
      qbo_invoice_id: null,
    });
    getClientQuickBooksProfileMock.mockResolvedValue({
      id: "client-1",
      company_name: "Acme",
      email: "billing@acme.com",
      qbo_customer_id: null,
      billing_address_line1: "123 Main",
      billing_address_line2: "Suite 1",
      billing_city: "Austin",
      billing_state: "TX",
      billing_postal_code: "78701",
    });
    findQuickBooksCustomerByDisplayNameMock.mockResolvedValue(null);
    createQuickBooksCustomerMock.mockResolvedValue({ Id: "qbo-customer-1" });
    setClientQuickBooksCustomerIdMock.mockResolvedValue({});
    createQuickBooksInvoiceMock.mockResolvedValue({ Id: "qbo-inv-1", TotalAmt: 150, Balance: 150 });
    extractQuickBooksInvoiceStateMock.mockReturnValue({
      qboInvoiceId: "qbo-inv-1",
      qboDocNumber: "INV-1",
      qboSyncStatus: "sent",
      amountPaid: 0,
      paidAt: null,
      paymentUrl: null,
      invoiceDate: "2025-12-01",
      invoiceTotal: 150,
    });
    updateInvoiceQuickBooksDataMock.mockResolvedValue({});

    await syncInvoiceToQuickBooks("inv-1");

    expect(createQuickBooksCustomerMock).toHaveBeenCalledWith("123", expect.objectContaining({
      billingAddress: {
        line1: "123 Main",
        line2: "Suite 1",
        city: "Austin",
        countrySubDivisionCode: "TX",
        postalCode: "78701",
      },
    }));
    expect(createQuickBooksInvoiceMock).toHaveBeenCalledWith("123", expect.objectContaining({
      invoiceNumber: "INV-1",
      amountDue: 150,
    }));
    expect(getQuickBooksInvoicePdfMock).not.toHaveBeenCalled();
    expect(updateInvoiceQuickBooksDataMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        pdfData: expect.anything(),
        pdfMimeType: expect.anything(),
        pdfFilename: expect.anything(),
        pdfSize: expect.anything(),
      })
    );
  });
});

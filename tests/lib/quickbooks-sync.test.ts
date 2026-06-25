import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getQuickBooksConnectionMock,
  getClientQboInvoiceIdsMock,
  getClientQuickBooksProfileMock,
  getInvoiceByIdMock,
  getInvoiceByQuickBooksInvoiceIdMock,
  setClientQuickBooksCustomerIdMock,
  updateInvoiceQuickBooksDataMock,
  updateInvoiceStatusByQuickBooksInvoiceIdMock,
  createMissingPaymentUrlLogIfNeededMock,
  createQuickBooksCustomerMock,
  createQuickBooksInvoiceMock,
  findQuickBooksCustomerByDisplayNameMock,
  getQuickBooksInvoiceMock,
  getQuickBooksInvoicePdfMock,
  sendQuickBooksInvoiceEmailMock,
  extractQuickBooksInvoiceStateMock,
  findQuickBooksInvoiceByDocNumberMock,
  createInvoiceMock,
  checkDuplicateByQboInvoiceIdMock,
} = vi.hoisted(() => ({
  getQuickBooksConnectionMock: vi.fn(),
  getClientQboInvoiceIdsMock: vi.fn(),
  getClientQuickBooksProfileMock: vi.fn(),
  getInvoiceByIdMock: vi.fn(),
  getInvoiceByQuickBooksInvoiceIdMock: vi.fn(),
  setClientQuickBooksCustomerIdMock: vi.fn(),
  updateInvoiceQuickBooksDataMock: vi.fn(),
  updateInvoiceStatusByQuickBooksInvoiceIdMock: vi.fn(),
  createMissingPaymentUrlLogIfNeededMock: vi.fn(),
  createQuickBooksCustomerMock: vi.fn(),
  createQuickBooksInvoiceMock: vi.fn(),
  findQuickBooksCustomerByDisplayNameMock: vi.fn(),
  getQuickBooksInvoiceMock: vi.fn(),
  getQuickBooksInvoicePdfMock: vi.fn(),
  sendQuickBooksInvoiceEmailMock: vi.fn(),
  extractQuickBooksInvoiceStateMock: vi.fn(),
  findQuickBooksInvoiceByDocNumberMock: vi.fn(),
  createInvoiceMock: vi.fn(),
  checkDuplicateByQboInvoiceIdMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getClientQboInvoiceIds: getClientQboInvoiceIdsMock,
  getClientQuickBooksProfile: getClientQuickBooksProfileMock,
  getInvoiceById: getInvoiceByIdMock,
  getInvoiceByQuickBooksInvoiceId: getInvoiceByQuickBooksInvoiceIdMock,
  setClientQuickBooksCustomerId: setClientQuickBooksCustomerIdMock,
  updateInvoiceQuickBooksData: updateInvoiceQuickBooksDataMock,
  getQuickBooksConnection: getQuickBooksConnectionMock,
  updateInvoiceStatusByQuickBooksInvoiceId: updateInvoiceStatusByQuickBooksInvoiceIdMock,
  createMissingPaymentUrlLogIfNeeded: createMissingPaymentUrlLogIfNeededMock,
  createInvoice: createInvoiceMock,
  checkDuplicateByQboInvoiceId: checkDuplicateByQboInvoiceIdMock,
}));

vi.mock("@/lib/quickbooks", () => ({
  getQuickBooksInvoice: getQuickBooksInvoiceMock,
  extractQuickBooksInvoiceState: extractQuickBooksInvoiceStateMock,
  createQuickBooksCustomer: createQuickBooksCustomerMock,
  createQuickBooksInvoice: createQuickBooksInvoiceMock,
  findQuickBooksCustomerByDisplayName: findQuickBooksCustomerByDisplayNameMock,
  findQuickBooksInvoiceByDocNumber: findQuickBooksInvoiceByDocNumberMock,
  getQuickBooksInvoicePdf: getQuickBooksInvoicePdfMock,
  sendQuickBooksInvoiceEmail: sendQuickBooksInvoiceEmailMock,
}));

import { linkInvoiceByDocNumber, syncClientInvoicesFromQuickBooks, syncInvoiceByQuickBooksInvoiceId, syncInvoiceToQuickBooks } from "@/lib/quickbooks-sync";

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
    expect(sendQuickBooksInvoiceEmailMock).toHaveBeenCalledWith("123", "qbo-inv-1", "billing@acme.com");
  });

  it("logs MissingQboPaymentUrl with admin-sync origin when sync results in missing payment URL", async () => {
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getInvoiceByIdMock.mockResolvedValue({
      id: "inv-2",
      client_id: "client-2",
      qbo_invoice_id: "qbo-inv-2",
      qbo_payment_url: "https://pay.example/abc",
    });
    getQuickBooksInvoiceMock.mockResolvedValue({ Id: "qbo-inv-2", TotalAmt: 150, Balance: 150 });
    extractQuickBooksInvoiceStateMock.mockReturnValue({
      qboInvoiceId: "qbo-inv-2",
      qboDocNumber: "INV-2",
      qboSyncStatus: "sent",
      amountPaid: 0,
      paidAt: null,
      paymentUrl: null,
      invoiceDate: "2026-01-01",
      invoiceTotal: 150,
    });
    updateInvoiceStatusByQuickBooksInvoiceIdMock.mockResolvedValue({
      id: "inv-2",
      client_id: "client-2",
      qbo_invoice_id: "qbo-inv-2",
      qbo_doc_number: "INV-2",
      qbo_sync_status: "sent",
    });

    await syncInvoiceToQuickBooks("inv-2", undefined, {
      origin: "admin-sync",
      route: "/api/invoices/[id]/sync",
      method: "POST",
    });

    expect(createMissingPaymentUrlLogIfNeededMock).toHaveBeenCalledWith(expect.objectContaining({
      origin: "admin-sync",
      invoiceId: "inv-2",
      clientId: "client-2",
    }));
  });

  it("logs for qbo-webhook only on non-null to null qbo_payment_url transition", async () => {
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getQuickBooksInvoiceMock.mockResolvedValue({ Id: "qbo-inv-3", TotalAmt: 100, Balance: 100 });
    extractQuickBooksInvoiceStateMock.mockReturnValue({
      qboInvoiceId: "qbo-inv-3",
      qboDocNumber: "INV-3",
      qboSyncStatus: "sent",
      amountPaid: 0,
      paidAt: null,
      paymentUrl: null,
      invoiceDate: "2026-01-05",
      invoiceTotal: 100,
    });
    getInvoiceByQuickBooksInvoiceIdMock.mockResolvedValue({
      id: "inv-3",
      client_id: "client-3",
      qbo_invoice_id: "qbo-inv-3",
      qbo_payment_url: "https://pay.example/old",
    });
    updateInvoiceStatusByQuickBooksInvoiceIdMock.mockResolvedValue({
      id: "inv-3",
      client_id: "client-3",
      qbo_invoice_id: "qbo-inv-3",
      qbo_doc_number: "INV-3",
      qbo_sync_status: "sent",
    });

    await syncInvoiceByQuickBooksInvoiceId("qbo-inv-3", {
      origin: "qbo-webhook",
      route: "/api/webhooks/quickbooks",
      method: "POST",
    });

    expect(createMissingPaymentUrlLogIfNeededMock).toHaveBeenCalledTimes(1);
    expect(updateInvoiceStatusByQuickBooksInvoiceIdMock).toHaveBeenCalledWith(expect.objectContaining({
      allowPaymentUrlClear: true,
    }));
  });

  it("triggers QuickBooks email when manually linking an invoice by DocNumber", async () => {
    const clientId = "client-1";
    const qboDocNumber = "INV-100";
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getClientQuickBooksProfileMock.mockResolvedValue({
      id: clientId,
      email: "client@example.com",
      qbo_customer_id: "qbo-cust-1",
    });
    findQuickBooksInvoiceByDocNumberMock.mockResolvedValue({
      Id: "qbo-inv-100",
      DocNumber: qboDocNumber,
      DueDate: "2026-07-01",
      TxnDate: "2026-06-01",
      TotalAmt: 200,
    });
    extractQuickBooksInvoiceStateMock.mockReturnValue({
      qboInvoiceId: "qbo-inv-100",
      qboDocNumber: qboDocNumber,
      qboSyncStatus: "sent",
      amountPaid: 0,
      paidAt: null,
      paymentUrl: "https://pay.example/100",
      invoiceDate: "2026-06-01",
      invoiceTotal: 200,
    });
    checkDuplicateByQboInvoiceIdMock.mockResolvedValue(false);
    createInvoiceMock.mockResolvedValue({ id: "local-inv-100" });

    await linkInvoiceByDocNumber({ clientId, qboDocNumber });

    expect(sendQuickBooksInvoiceEmailMock).toHaveBeenCalledWith("123", "qbo-inv-100", "client@example.com");
  });

  it("does not log for qbo-webhook when qbo_payment_url is already null and remains null", async () => {
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getQuickBooksInvoiceMock.mockResolvedValue({ Id: "qbo-inv-4", TotalAmt: 100, Balance: 100 });
    extractQuickBooksInvoiceStateMock.mockReturnValue({
      qboInvoiceId: "qbo-inv-4",
      qboDocNumber: "INV-4",
      qboSyncStatus: "sent",
      amountPaid: 0,
      paidAt: null,
      paymentUrl: null,
      invoiceDate: "2026-01-06",
      invoiceTotal: 100,
    });
    getInvoiceByQuickBooksInvoiceIdMock.mockResolvedValue({
      id: "inv-4",
      client_id: "client-4",
      qbo_invoice_id: "qbo-inv-4",
      qbo_payment_url: null,
    });
    updateInvoiceStatusByQuickBooksInvoiceIdMock.mockResolvedValue({
      id: "inv-4",
      client_id: "client-4",
      qbo_invoice_id: "qbo-inv-4",
      qbo_doc_number: "INV-4",
      qbo_sync_status: "sent",
    });

    await syncInvoiceByQuickBooksInvoiceId("qbo-inv-4", {
      origin: "qbo-webhook",
      route: "/api/webhooks/quickbooks",
      method: "POST",
    });

    expect(createMissingPaymentUrlLogIfNeededMock).not.toHaveBeenCalled();
  });
});

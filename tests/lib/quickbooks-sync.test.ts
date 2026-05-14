import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getQuickBooksConnectionMock,
  getClientQboInvoiceIdsMock,
  updateInvoiceStatusByQuickBooksInvoiceIdMock,
  getQuickBooksInvoiceMock,
  extractQuickBooksInvoiceStateMock,
} = vi.hoisted(() => ({
  getQuickBooksConnectionMock: vi.fn(),
  getClientQboInvoiceIdsMock: vi.fn(),
  updateInvoiceStatusByQuickBooksInvoiceIdMock: vi.fn(),
  getQuickBooksInvoiceMock: vi.fn(),
  extractQuickBooksInvoiceStateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getClientQboInvoiceIds: getClientQboInvoiceIdsMock,
  getQuickBooksConnection: getQuickBooksConnectionMock,
  updateInvoiceStatusByQuickBooksInvoiceId: updateInvoiceStatusByQuickBooksInvoiceIdMock,
  getClientQuickBooksProfile: vi.fn(),
  getInvoiceById: vi.fn(),
  setClientQuickBooksCustomerId: vi.fn(),
  updateInvoiceQuickBooksData: vi.fn(),
  createInvoice: vi.fn(),
  checkDuplicateByQboInvoiceId: vi.fn(),
}));

vi.mock("@/lib/quickbooks", () => ({
  getQuickBooksInvoice: getQuickBooksInvoiceMock,
  extractQuickBooksInvoiceState: extractQuickBooksInvoiceStateMock,
  createQuickBooksCustomer: vi.fn(),
  createQuickBooksInvoice: vi.fn(),
  findQuickBooksCustomerByDisplayName: vi.fn(),
  findQuickBooksInvoiceByDocNumber: vi.fn(),
  getQuickBooksInvoicePdf: vi.fn(),
}));

import { syncClientInvoicesFromQuickBooks } from "@/lib/quickbooks-sync";

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
});

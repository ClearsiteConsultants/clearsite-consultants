import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  getQuickBooksConnectionMock,
  getAllClientsMock,
  sqlMock,
  syncClientInvoicesFromQuickBooksMock,
  getQuickBooksItemsMock,
  getQuickBooksCustomersMock,
  persistApiErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getQuickBooksConnectionMock: vi.fn(),
  getAllClientsMock: vi.fn(),
  sqlMock: vi.fn(),
  syncClientInvoicesFromQuickBooksMock: vi.fn(),
  getQuickBooksItemsMock: vi.fn(),
  getQuickBooksCustomersMock: vi.fn(),
  persistApiErrorMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));

vi.mock("@/lib/db", () => ({
  getQuickBooksConnection: getQuickBooksConnectionMock,
  getAllClients: getAllClientsMock,
  sql: sqlMock,
}));

vi.mock("@/lib/quickbooks-sync", () => ({
  syncClientInvoicesFromQuickBooks: syncClientInvoicesFromQuickBooksMock,
}));

vi.mock("@/lib/quickbooks", () => ({
  getQuickBooksItems: getQuickBooksItemsMock,
  getQuickBooksCustomers: getQuickBooksCustomersMock,
  isQuickBooksReconnectRequiredError: (error: unknown) => Boolean((error as { reconnectRequired?: boolean })?.reconnectRequired),
}));

vi.mock("@/lib/error-logger", () => ({
  persistApiError: persistApiErrorMock,
}));

import { POST } from "@/app/api/admin/sync/route";

describe("POST /api/admin/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "realm-1" });
    getAllClientsMock.mockResolvedValue([{ id: "c-1" }, { id: "c-2" }]);
    syncClientInvoicesFromQuickBooksMock
      .mockResolvedValueOnce({ synced: 2, failed: 1 })
      .mockResolvedValueOnce({ synced: 3, failed: 0 });
    getQuickBooksItemsMock.mockResolvedValue([{ Id: "1" }, { Id: "2" }]);
    getQuickBooksCustomersMock.mockResolvedValue([{ Id: "1" }]);
    sqlMock.mockResolvedValue({ rows: [{ count: 1 }] });
  });

  it("enforces admin auth", async () => {
    authMock.mockResolvedValue({ user: { id: "client:1", user_type: "client" } });

    const res = await POST();

    expect(res.status).toBe(401);
  });

  it("returns orchestration summary for successful manual sync", async () => {
    const res = await POST();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.invoiceSync.clientsProcessed).toBe(2);
    expect(payload.invoiceSync.syncedInvoices).toBe(5);
    expect(payload.invoiceSync.failedInvoices).toBe(1);
    expect(payload.qboData.productsServicesCount).toBe(2);
    expect(payload.qboData.customersCount).toBe(1);
    expect(payload.developerLogs.created).toBe(true);
    expect(syncClientInvoicesFromQuickBooksMock).toHaveBeenNthCalledWith(1, "c-1", {
      origin: "admin-sync",
      route: "/api/admin/sync",
      method: "POST",
    });
    expect(syncClientInvoicesFromQuickBooksMock).toHaveBeenNthCalledWith(2, "c-2", {
      origin: "admin-sync",
      route: "/api/admin/sync",
      method: "POST",
    });
  });
});

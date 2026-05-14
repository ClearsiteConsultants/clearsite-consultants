import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
const getQuickBooksConnectionMock = vi.fn();
const createInvoiceMock = vi.fn();
const syncInvoiceToQuickBooksMock = vi.fn();
const getQuickBooksItemsMock = vi.fn();

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));

vi.mock("@/lib/db", () => ({
  updateClientPlan: vi.fn(),
  cancelClientService: vi.fn(),
  createInvoice: createInvoiceMock,
  getAllClients: vi.fn(),
  getClientInvoicesForPortal: vi.fn(),
  getQuickBooksConnection: getQuickBooksConnectionMock,
}));

vi.mock("@/lib/quickbooks", () => ({
  getQuickBooksItems: getQuickBooksItemsMock,
  getQuickBooksCustomers: vi.fn(),
  isQuickBooksReconnectRequiredError: (error: unknown) => Boolean((error as { reconnectRequired?: boolean })?.reconnectRequired),
}));

vi.mock("@/lib/quickbooks-sync", () => ({
  syncClientInvoicesFromQuickBooks: vi.fn(),
  syncInvoiceToQuickBooks: syncInvoiceToQuickBooksMock,
  linkInvoiceById: vi.fn(),
}));

import { GET, POST } from "@/app/api/invoices/route";

describe("/api/invoices reconnect-required responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
  });

  it("returns reconnectRequired=true for qbo-items when auth is invalid", async () => {
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "123" });
    getQuickBooksItemsMock.mockRejectedValue({
      reconnectRequired: true,
      reconnectReason: "api_unauthorized",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices?action=qbo-items");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(503);
    expect(payload.reconnectRequired).toBe(true);
    expect(payload.reconnectReason).toBe("api_unauthorized");
  });

  it("returns reconnectRequired when create+sync hits invalid auth", async () => {
    createInvoiceMock.mockResolvedValue({
      id: "inv-1",
      client_id: "1",
      qbo_sync_status: "pending",
    });
    syncInvoiceToQuickBooksMock.mockRejectedValue({
      reconnectRequired: true,
      reconnectReason: "invalid_grant",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        amount_due: 100,
        due_date: "2026-01-01",
        sync_to_qbo: true,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.reconnectRequired).toBe(true);
    expect(payload.reconnectReason).toBe("invalid_grant");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  authMock,
  getQuickBooksConnectionMock,
  createInvoiceMock,
  getClientBillingAddressMock,
  syncInvoiceToQuickBooksMock,
  getQuickBooksItemsMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getQuickBooksConnectionMock: vi.fn(),
  createInvoiceMock: vi.fn(),
  getClientBillingAddressMock: vi.fn(),
  syncInvoiceToQuickBooksMock: vi.fn(),
  getQuickBooksItemsMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));

vi.mock("@/lib/db", () => ({
  updateClientPlan: vi.fn(),
  cancelClientService: vi.fn(),
  createInvoice: createInvoiceMock,
  getClientBillingAddress: getClientBillingAddressMock,
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
    getClientBillingAddressMock.mockResolvedValue({
      id: "1",
      billing_address_line1: "123 Main St",
      billing_city: "Austin",
      billing_state: "TX",
      billing_postal_code: "78701",
      billing_country: "US",
    });
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
        invoice_total: 100,
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

  it("blocks invoice creation when required billing address fields are missing", async () => {
    getClientBillingAddressMock.mockResolvedValue({
      id: "1",
      billing_address_line1: null,
      billing_city: "Austin",
      billing_state: "TX",
      billing_postal_code: "78701",
      billing_country: "US",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        invoice_total: 100,
        due_date: "2026-01-01",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Billing address is incomplete");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });
});

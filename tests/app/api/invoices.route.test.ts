import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function futureDueDate(daysFromNow = 60): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function futureDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const {
  authMock,
  getQuickBooksConnectionMock,
  createInvoiceMock,
  getClientBillingAddressMock,
  getClientInvoicesForPortalMock,
  syncInvoiceToQuickBooksMock,
  linkInvoiceByDocNumberMock,
  getQuickBooksItemsMock,
  createMissingPaymentUrlLogIfNeededMock,
  persistApiErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getQuickBooksConnectionMock: vi.fn(),
  createInvoiceMock: vi.fn(),
  getClientBillingAddressMock: vi.fn(),
  getClientInvoicesForPortalMock: vi.fn(),
  syncInvoiceToQuickBooksMock: vi.fn(),
  linkInvoiceByDocNumberMock: vi.fn(),
  getQuickBooksItemsMock: vi.fn(),
  createMissingPaymentUrlLogIfNeededMock: vi.fn(),
  persistApiErrorMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));

vi.mock("@/lib/db", () => ({
  updateClientPlan: vi.fn(),
  deactivatePlan: vi.fn(),
  createInvoice: createInvoiceMock,
  getClientBillingAddress: getClientBillingAddressMock,
  getAllClients: vi.fn(),
  getClientInvoicesForPortal: getClientInvoicesForPortalMock,
  createMissingPaymentUrlLogIfNeeded: createMissingPaymentUrlLogIfNeededMock,
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
  linkInvoiceByDocNumber: linkInvoiceByDocNumberMock,
}));

vi.mock("@/lib/error-logger", () => ({
  persistApiError: persistApiErrorMock,
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

  it("links manual-link invoices by qbo_doc_number", async () => {
    linkInvoiceByDocNumberMock.mockResolvedValue({
      id: "inv-link-1",
      client_id: "1",
      qbo_doc_number: "1007",
      qbo_invoice_id: "215",
      is_manual_link: true,
    });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        mode: "manual-link",
        manual_link_mode: "existing-client",
        client_id: "1",
        qbo_doc_number: "1007",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.qbo_doc_number).toBe("1007");
    expect(linkInvoiceByDocNumberMock).toHaveBeenCalledWith({
      clientId: "1",
      qboCustomerId: undefined,
      qboDocNumber: "1007",
    }, {
      origin: "admin-link",
      route: "/api/invoices",
      method: "POST",
    });
  });

  it("does not log missing qbo_payment_url warnings during client invoice fetch", async () => {
    authMock.mockResolvedValue({ user: { id: "client:42", user_type: "client" } });
    getClientInvoicesForPortalMock.mockResolvedValue([
      {
        id: "inv-1",
        qbo_doc_number: "1001",
        qbo_invoice_id: "2001",
        qbo_sync_status: "sent",
        paid_at: null,
        qbo_payment_url: null,
      },
      {
        id: "inv-2",
        qbo_doc_number: "1002",
        qbo_invoice_id: "2002",
        qbo_sync_status: "paid",
        paid_at: "2026-05-01T00:00:00.000Z",
        qbo_payment_url: null,
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/invoices");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(createMissingPaymentUrlLogIfNeededMock).not.toHaveBeenCalled();
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
        due_date: futureDueDate(),
        sync_to_qbo: true,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.reconnectRequired).toBe(true);
    expect(payload.reconnectReason).toBe("invalid_grant");
    expect(persistApiErrorMock).toHaveBeenCalled();
  });

  it("allows invoice creation when required billing address fields are missing", async () => {
    getClientBillingAddressMock.mockResolvedValue({
      id: "1",
      billing_address_line1: null,
      billing_city: "Austin",
      billing_state: "TX",
      billing_postal_code: "78701",
      billing_country: "US",
    });

    createInvoiceMock.mockResolvedValue({ id: "inv-2", client_id: "1" });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        invoice_total: 100,
        due_date: futureDueDate(),
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.id).toBe("inv-2");
    expect(createInvoiceMock).toHaveBeenCalled();
  });

  it("blocks invoice creation when billing address fields exceed limits", async () => {
    getClientBillingAddressMock.mockResolvedValueOnce({
      id: "1",
      billing_address_line1: "A".repeat(100), // Max is 46
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
        due_date: "2026-07-06",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Billing address has invalid field lengths: line1");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("blocks invoice creation when billing state code is invalid", async () => {
    getClientBillingAddressMock.mockResolvedValueOnce({
      id: "1",
      billing_address_line1: "123 Main",
      billing_city: "Austin",
      billing_state: "Texas", // Should be 2-letter uppercase
      billing_postal_code: "78701",
      billing_country: "US",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        invoice_total: 100,
        due_date: "2026-07-06",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Billing address state must be a 2-letter uppercase code");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("rejects due dates earlier than 30 days after the invoice date", async () => {
    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        invoice_total: 100,
        invoice_date: futureDate(40),
        due_date: futureDate(55),
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Due date must be at least 30 days after the invoice date");
    expect(createInvoiceMock).not.toHaveBeenCalled();
  });

  it("accepts due dates that are at least 30 days after the invoice date", async () => {
    createInvoiceMock.mockResolvedValue({
      id: "inv-2",
      client_id: "1",
      qbo_sync_status: "pending",
      qbo_invoice_id: "qbo-inv-2",
      qbo_doc_number: "1002",
    });
    syncInvoiceToQuickBooksMock.mockResolvedValue({
      id: "inv-2",
      client_id: "1",
      qbo_invoice_id: "qbo-inv-2",
      qbo_doc_number: "1002",
      qbo_sync_status: "sent",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        invoice_total: 100,
        invoice_date: futureDate(10),
        due_date: futureDate(40),
        sync_to_qbo: true,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.qbo_doc_number).toBe("1002");
  });

  it("accepts due dates that are exactly 30 days or more in the future", async () => {
    createInvoiceMock.mockResolvedValue({
      id: "inv-1",
      client_id: "1",
      qbo_sync_status: "pending",
      qbo_invoice_id: "qbo-inv-1",
      qbo_doc_number: "1001",
    });
    syncInvoiceToQuickBooksMock.mockResolvedValue({
      id: "inv-1",
      client_id: "1",
      qbo_invoice_id: "qbo-inv-1",
      qbo_doc_number: "1001",
      qbo_sync_status: "sent",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: "1",
        invoice_total: 100,
        due_date: futureDueDate(),
        sync_to_qbo: true,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(createInvoiceMock).toHaveBeenCalled();
  });
});

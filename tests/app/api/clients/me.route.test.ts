import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  authMock,
  sqlMock,
  updateClientBillingAddressMock,
  syncClientInvoicesFromQuickBooksMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  sqlMock: vi.fn(),
  updateClientBillingAddressMock: vi.fn(),
  syncClientInvoicesFromQuickBooksMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));

vi.mock("@/lib/db", () => ({
  sql: sqlMock,
  updateClientBillingAddress: updateClientBillingAddressMock,
}));

vi.mock("@/lib/quickbooks-sync", () => ({
  syncClientInvoicesFromQuickBooks: syncClientInvoicesFromQuickBooksMock,
}));

import { GET, PATCH } from "@/app/api/clients/me/route";

const mockClientRow = {
  id: 42,
  email: "test@example.com",
  company_name: "Test Co",
  first_name: "Jane",
  last_name: "Doe",
  domain_name: "test.com",
  plan: "Starter",
  service_status: "Active",
  next_invoice_due: null,
  billing_address_line1: "123 Main St",
  billing_address_line2: null,
  billing_address_city: "Chicago",
  billing_address_state: "IL",
  billing_address_zip: "60601",
  billing_address_country: "United States",
};

describe("GET /api/clients/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "client:42", user_type: "client" } });
    syncClientInvoicesFromQuickBooksMock.mockResolvedValue(undefined);
    sqlMock.mockResolvedValue({ rows: [mockClientRow] });
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 401 for admin users", async () => {
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });

    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns client data including billing address fields", async () => {
    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.billing_address_line1).toBe("123 Main St");
    expect(payload.billing_address_city).toBe("Chicago");
    expect(payload.billing_address_state).toBe("IL");
    expect(payload.billing_address_zip).toBe("60601");
    expect(payload.billing_address_country).toBe("United States");
  });

  it("returns 404 when client not found", async () => {
    sqlMock.mockResolvedValue({ rows: [] });

    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.error).toBe("Client not found");
  });
});

describe("PATCH /api/clients/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "client:42", user_type: "client" } });
    updateClientBillingAddressMock.mockResolvedValue({
      id: 42,
      billing_address_line1: "123 Main St",
      billing_address_line2: null,
      billing_address_city: "Chicago",
      billing_address_state: "IL",
      billing_address_zip: "60601",
      billing_address_country: "United States",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/clients/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await PATCH(req);
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("returns 401 for admin users", async () => {
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });

    const req = new NextRequest("http://localhost:3000/api/clients/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await PATCH(req);
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("saves billing address and returns updated fields", async () => {
    const req = new NextRequest("http://localhost:3000/api/clients/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        billing_address_line1: "123 Main St",
        billing_address_line2: null,
        billing_address_city: "Chicago",
        billing_address_state: "IL",
        billing_address_zip: "60601",
        billing_address_country: "United States",
      }),
    });

    const res = await PATCH(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.billing_address_line1).toBe("123 Main St");
    expect(payload.billing_address_city).toBe("Chicago");
    expect(updateClientBillingAddressMock).toHaveBeenCalledWith("42", {
      billing_address_line1: "123 Main St",
      billing_address_line2: null,
      billing_address_city: "Chicago",
      billing_address_state: "IL",
      billing_address_zip: "60601",
      billing_address_country: "United States",
    });
  });

  it("returns 404 when client not found in DB", async () => {
    updateClientBillingAddressMock.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/clients/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ billing_address_line1: "123 Main St" }),
    });

    const res = await PATCH(req);
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.error).toBe("Client not found");
  });

  it("treats empty strings as null for optional fields", async () => {
    const req = new NextRequest("http://localhost:3000/api/clients/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        billing_address_line1: "123 Main St",
        billing_address_line2: "",
        billing_address_city: "Chicago",
        billing_address_state: "IL",
        billing_address_zip: "60601",
        billing_address_country: "United States",
      }),
    });

    await PATCH(req);

    expect(updateClientBillingAddressMock).toHaveBeenCalledWith("42", expect.objectContaining({
      billing_address_line2: null,
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  sqlMock,
  updateClientBillingAddressMock,
  getQuickBooksConnectionMock,
  updateQuickBooksCustomerBillingAddressMock,
  syncClientInvoicesFromQuickBooksMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  sqlMock: vi.fn(),
  updateClientBillingAddressMock: vi.fn(),
  getQuickBooksConnectionMock: vi.fn(),
  updateQuickBooksCustomerBillingAddressMock: vi.fn(),
  syncClientInvoicesFromQuickBooksMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));

vi.mock("@/lib/db", () => ({
  sql: sqlMock,
  updateClientBillingAddress: updateClientBillingAddressMock,
  getQuickBooksConnection: getQuickBooksConnectionMock,
}));

vi.mock("@/lib/quickbooks", () => ({
  updateQuickBooksCustomerBillingAddress: updateQuickBooksCustomerBillingAddressMock,
}));

vi.mock("@/lib/quickbooks-sync", () => ({
  syncClientInvoicesFromQuickBooks: syncClientInvoicesFromQuickBooksMock,
}));

import { GET, PUT } from "@/app/api/clients/me/route";

describe("/api/clients/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "client:1", user_type: "client" } });
  });

  it("returns billing address fields from GET", async () => {
    sqlMock.mockResolvedValue({
      rows: [{
        id: "1",
        company_name: "Acme",
        billing_address_line1: "123 Main",
        billing_city: "Austin",
        billing_state: "TX",
        billing_postal_code: "78701",
        billing_country: "US",
      }],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.billing_address_line1).toBe("123 Main");
    expect(syncClientInvoicesFromQuickBooksMock).toHaveBeenCalledWith("1");
  });

  it("falls back to legacy clients schema when billing columns are missing", async () => {
    sqlMock
      .mockRejectedValueOnce(new Error('column "billing_address_line1" does not exist'))
      .mockResolvedValueOnce({
        rows: [{
          id: "1",
          email: "client@example.com",
          company_name: "Acme",
          first_name: "Alex",
          last_name: "Client",
          domain_name: "acme.com",
          plan: "Growth",
          service_status: "Active",
          next_invoice_due: "2026-06-01",
          qbo_customer_id: null,
        }],
      });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe("1");
    expect(payload.billing_address_line1).toBeNull();
    expect(payload.billing_city).toBeNull();
  });

  it("saves billing address and syncs to QuickBooks when customer is linked", async () => {
    updateClientBillingAddressMock.mockResolvedValue({
      id: "1",
      qbo_customer_id: "qbo-1",
      billing_address_line1: "123 Main",
      billing_address_line2: "Suite 1",
      billing_city: "Austin",
      billing_state: "TX",
      billing_postal_code: "78701",
      billing_country: "US",
    });
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "realm-1" });

    const response = await PUT(new Request("http://localhost:3000/api/clients/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        billing_address_line1: "123 Main",
        billing_city: "Austin",
        billing_state: "TX",
        billing_postal_code: "78701"
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.warning).toBeNull();
    expect(updateQuickBooksCustomerBillingAddressMock).toHaveBeenCalledWith("realm-1", "qbo-1", {
      line1: "123 Main",
      line2: "Suite 1",
      city: "Austin",
      countrySubDivisionCode: "TX",
      postalCode: "78701",
      country: "US",
    });
  });

  it("returns warning when QuickBooks billing sync fails but local save succeeds", async () => {
    updateClientBillingAddressMock.mockResolvedValue({
      id: "1",
      qbo_customer_id: "qbo-1",
      billing_address_line1: "123 Main",
      billing_address_line2: null,
      billing_city: "Austin",
      billing_state: "TX",
      billing_postal_code: "78701",
      billing_country: "US",
    });
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "realm-1" });
    updateQuickBooksCustomerBillingAddressMock.mockRejectedValue(new Error("boom"));

    const response = await PUT(new Request("http://localhost:3000/api/clients/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        billing_address_line1: "123 Main",
        billing_city: "Austin",
        billing_state: "TX",
        billing_postal_code: "78701"
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.warning).toBe("Billing address was saved, but QuickBooks sync could not be completed.");
  });

  it("creates missing billing columns and retries save when schema is outdated", async () => {
    updateClientBillingAddressMock
      .mockRejectedValueOnce(new Error('column "billing_address_line1" does not exist'))
      .mockResolvedValueOnce({
        id: "1",
        qbo_customer_id: null,
        billing_address_line1: "123 Main",
        billing_address_line2: null,
        billing_city: "Austin",
        billing_state: "TX",
        billing_postal_code: "78701",
        billing_country: "US",
      });
    sqlMock.mockResolvedValue({ rows: [] });

    const response = await PUT(new Request("http://localhost:3000/api/clients/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        billing_address_line1: "123 Main",
        billing_city: "Austin",
        billing_state: "TX",
        billing_postal_code: "78701"
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.billing_address_line1).toBe("123 Main");
    expect(updateClientBillingAddressMock).toHaveBeenCalledTimes(2);
    expect(sqlMock).toHaveBeenCalledTimes(6);
  });
});

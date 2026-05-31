import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, sqlMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sqlMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

import { GET, PUT } from "@/app/api/admin/clients/route";

describe("/api/admin/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
  });

  it("allows admins to explicitly cancel a plan by setting plan to null", async () => {
    sqlMock.mockResolvedValue({
      rows: [{ id: "1", plan: null, service_status: "Active" }],
    });

    const response = await PUT(new NextRequest("http://localhost:3000/api/admin/clients", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "1", plan: null }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.client.plan).toBeNull();
  });

  it("returns action_needed for clients missing payment links on unpaid invoices", async () => {
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "1",
          company_name: "Acme",
          email: "ops@acme.com",
          plan: "Starter",
          service_status: "Active",
          first_name: "A",
          last_name: "User",
          phone: null,
          next_invoice_due: "2026-06-30",
          action_needed: true,
        },
      ],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload[0].action_needed).toBe(true);
  });

  it("returns action_needed when MissingQboPaymentUrl logs exist for a client invoice", async () => {
    sqlMock.mockResolvedValue({
      rows: [
        {
          id: "2",
          company_name: "Globex",
          email: "ops@globex.com",
          plan: "Starter",
          service_status: "Active",
          first_name: "G",
          last_name: "User",
          phone: null,
          next_invoice_due: "2026-06-30",
          action_needed: true,
        },
      ],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload[0].action_needed).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, sqlMock, persistApiErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sqlMock: vi.fn(),
  persistApiErrorMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));
vi.mock("@/lib/error-logger", () => ({ persistApiError: persistApiErrorMock }));

import { GET } from "@/app/api/admin/clients/[clientId]/billing/route";

describe("/api/admin/clients/[clientId]/billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
  });

  it("returns 401 when unauthorized", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/clients/4/billing"),
      { params: Promise.resolve({ clientId: "4" }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the client does not exist", async () => {
    sqlMock.mockResolvedValueOnce({ rows: [] });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/clients/404/billing"),
      { params: Promise.resolve({ clientId: "404" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns client invoices with summary totals and statuses", async () => {
    sqlMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "4",
            company_name: "Tide Chix",
            email: "tidechix@gmail.com",
            first_name: "Lacy",
            last_name: "Blue",
            plan: "Starter",
            service_status: "Active",
            maintenance_fee_frequency: "Monthly",
            next_invoice_due: "2026-08-31",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "invoice-1004",
            qbo_invoice_id: "90",
            qbo_doc_number: "1004",
            invoice_total: "250.00",
            amount_paid: "250.00",
            invoice_date: "2026-05-27",
            due_date: "2026-06-26",
            qbo_sync_status: "paid",
            paid_at: "2026-06-01",
            last_synced_at: "2026-07-28T18:00:00.000Z",
            created_at: "2026-07-28T18:00:00.000Z",
          },
          {
            id: "invoice-1012",
            qbo_invoice_id: "101",
            qbo_doc_number: "1012",
            invoice_total: "10.00",
            amount_paid: "0",
            invoice_date: "2026-08-01",
            due_date: "2026-08-31",
            qbo_sync_status: "sent",
            paid_at: null,
            last_synced_at: "2026-07-28T18:00:00.000Z",
            created_at: "2026-07-28T18:00:00.000Z",
          },
        ],
      });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/clients/4/billing"),
      { params: Promise.resolve({ clientId: "4" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.client.company_name).toBe("Tide Chix");
    expect(payload.invoices).toHaveLength(2);
    expect(payload.invoices[0].status).toBe("paid");
    expect(payload.invoices[1].status).toBe("pending");
    expect(payload.summary).toEqual({
      totalPaid: 250,
      outstandingBalance: 10,
      overdueCount: 0,
      pendingCount: 1,
    });
  });
});

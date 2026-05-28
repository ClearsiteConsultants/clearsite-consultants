import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, sqlMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sqlMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

import { GET } from "@/app/api/admin/clients/[clientId]/action-needed/route";

describe("/api/admin/clients/[clientId]/action-needed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
  });

  it("returns 401 when unauthorized", async () => {
    authMock.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost:3000/api/admin/clients/client-1/action-needed"),
      { params: Promise.resolve({ clientId: "client-1" }) }
    );

    expect(res.status).toBe(401);
  });

  it("returns actionNeeded true with issues for authorized admin", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: "client-1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            invoice_id: "inv-1",
            qbo_doc_number: "1001",
            qbo_invoice_id: "qbo-1",
            qbo_sync_status: "pending",
            due_date: "2026-06-15",
            invoice_date: "2026-05-15",
            amount_total: 1200,
            amount_paid: 0,
            last_synced_at: "2026-05-27T10:00:00.000Z",
            created_at: "2026-05-26T09:00:00.000Z",
            logged_error_message: "MISSING_QBO_PAY_URL inv:1001 cli:client-1",
            logged_at: "2026-05-27T11:00:00.000Z",
          },
        ],
      });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/admin/clients/client-1/action-needed"),
      { params: Promise.resolve({ clientId: "client-1" }) }
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.actionNeeded).toBe(true);
    expect(payload.issues).toHaveLength(1);
    expect(payload.issues[0]).toMatchObject({
      invoiceId: "inv-1",
      qboDocNumber: "1001",
      qboInvoiceId: "qbo-1",
      errorMessage: "MISSING_QBO_PAY_URL inv:1001 cli:client-1",
    });
  });

  it("returns actionNeeded false when there are no issues", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ id: "client-2" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      new NextRequest("http://localhost:3000/api/admin/clients/client-2/action-needed"),
      { params: Promise.resolve({ clientId: "client-2" }) }
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.actionNeeded).toBe(false);
    expect(payload.issues).toEqual([]);
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
const syncInvoiceToQuickBooksMock = vi.fn();

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/quickbooks-sync", () => ({ syncInvoiceToQuickBooks: syncInvoiceToQuickBooksMock }));
vi.mock("@/lib/quickbooks", () => ({
  isQuickBooksReconnectRequiredError: (error: unknown) => Boolean((error as { reconnectRequired?: boolean })?.reconnectRequired),
}));

import { POST } from "@/app/api/invoices/[id]/sync/route";

describe("POST /api/invoices/[id]/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
  });

  it("returns reconnectRequired for invalid auth errors", async () => {
    syncInvoiceToQuickBooksMock.mockRejectedValue({
      reconnectRequired: true,
      reconnectReason: "api_unauthorized",
    });
    const req = new NextRequest("http://localhost:3000/api/invoices/1/sync", { method: "POST" });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    const payload = await res.json();

    expect(res.status).toBe(503);
    expect(payload.reconnectRequired).toBe(true);
    expect(payload.reconnectReason).toBe("api_unauthorized");
  });

  it("keeps non-auth errors as standard sync failures", async () => {
    syncInvoiceToQuickBooksMock.mockRejectedValue(new Error("sync failed"));
    const req = new NextRequest("http://localhost:3000/api/invoices/1/sync", { method: "POST" });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("sync failed");
    expect(payload.reconnectRequired).toBeUndefined();
  });
});

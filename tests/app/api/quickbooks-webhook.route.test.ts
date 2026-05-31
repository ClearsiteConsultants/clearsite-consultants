import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  verifyQuickBooksWebhookSignatureMock,
  syncInvoiceByQuickBooksInvoiceIdMock,
} = vi.hoisted(() => ({
  verifyQuickBooksWebhookSignatureMock: vi.fn(),
  syncInvoiceByQuickBooksInvoiceIdMock: vi.fn(),
}));

vi.mock("@/lib/quickbooks", () => ({
  verifyQuickBooksWebhookSignature: verifyQuickBooksWebhookSignatureMock,
}));

vi.mock("@/lib/quickbooks-sync", () => ({
  syncInvoiceByQuickBooksInvoiceId: syncInvoiceByQuickBooksInvoiceIdMock,
}));

import { POST } from "@/app/api/webhooks/quickbooks/route";

describe("POST /api/webhooks/quickbooks", () => {
  it("rejects invalid signatures", async () => {
    verifyQuickBooksWebhookSignatureMock.mockReturnValue(false);

    const req = new NextRequest("http://localhost:3000/api/webhooks/quickbooks", {
      method: "POST",
      body: JSON.stringify({ eventNotifications: [] }),
      headers: { "content-type": "application/json", "intuit-signature": "bad" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("propagates qbo-webhook origin context for invoice entity sync calls", async () => {
    verifyQuickBooksWebhookSignatureMock.mockReturnValue(true);
    syncInvoiceByQuickBooksInvoiceIdMock.mockResolvedValue({ id: "inv-1" });

    const req = new NextRequest("http://localhost:3000/api/webhooks/quickbooks", {
      method: "POST",
      body: JSON.stringify({
        eventNotifications: [
          {
            dataChangeEvent: {
              entities: [
                { name: "Invoice", id: "qbo-inv-1" },
                { name: "Customer", id: "qbo-cus-1" },
              ],
            },
          },
        ],
      }),
      headers: { "content-type": "application/json", "intuit-signature": "ok" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.received).toBe(true);
    expect(syncInvoiceByQuickBooksInvoiceIdMock).toHaveBeenCalledWith("qbo-inv-1", {
      origin: "qbo-webhook",
      route: "/api/webhooks/quickbooks",
      method: "POST",
    });
  });
});

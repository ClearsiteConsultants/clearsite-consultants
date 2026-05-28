import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  authMock,
  getInvoicePdfByIdMock,
  getQuickBooksConnectionMock,
  getQuickBooksInvoicePdfMock,
  isQuickBooksReconnectRequiredErrorMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getInvoicePdfByIdMock: vi.fn(),
  getQuickBooksConnectionMock: vi.fn(),
  getQuickBooksInvoicePdfMock: vi.fn(),
  isQuickBooksReconnectRequiredErrorMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({
  getInvoicePdfById: getInvoicePdfByIdMock,
  getQuickBooksConnection: getQuickBooksConnectionMock,
}));
vi.mock("@/lib/quickbooks", () => ({
  getQuickBooksInvoicePdf: getQuickBooksInvoicePdfMock,
  isQuickBooksReconnectRequiredError: isQuickBooksReconnectRequiredErrorMock,
}));

import { GET } from "@/app/api/invoices/[id]/pdf/route";

describe("GET /api/invoices/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isQuickBooksReconnectRequiredErrorMock.mockReturnValue(false);
  });

  it("blocks admin users from downloading invoice PDFs", async () => {
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
    getInvoicePdfByIdMock.mockResolvedValue({
      id: "inv-1",
      client_id: "1",
      qbo_invoice_id: "qbo-1",
      qbo_doc_number: "INV-001",
    });

    const req = new NextRequest("http://localhost:3000/api/invoices/inv-1/pdf");
    const res = await GET(req, { params: Promise.resolve({ id: "inv-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error).toBe("Admins cannot download client PDFs; view in QuickBooks Online instead");
    expect(getQuickBooksInvoicePdfMock).not.toHaveBeenCalled();
  });

  it("always returns a live QBO PDF payload instead of legacy stored bytes", async () => {
    authMock.mockResolvedValue({ user: { id: "client:1", user_type: "client" } });
    getInvoicePdfByIdMock.mockResolvedValue({
      id: "inv-1",
      client_id: "1",
      qbo_invoice_id: "qbo-1",
      qbo_doc_number: "INV/001",
      pdf_data: Buffer.from("legacy-bytes"),
    });
    getQuickBooksConnectionMock.mockResolvedValue({ realm_id: "realm-1" });
    getQuickBooksInvoicePdfMock.mockResolvedValue({
      data: Buffer.from("fresh-qbo-pdf"),
      mimeType: "application/pdf",
      filename: "ignored.pdf",
      size: 13,
    });

    const req = new NextRequest("http://localhost:3000/api/invoices/inv-1/pdf");
    const res = await GET(req, { params: Promise.resolve({ id: "inv-1" }) });
    const body = Buffer.from(await res.arrayBuffer()).toString("utf8");

    expect(res.status).toBe(200);
    expect(body).toBe("fresh-qbo-pdf");
    expect(res.headers.get("content-disposition")).toBe("attachment; filename=\"INV_001.pdf\"");
    expect(getQuickBooksInvoicePdfMock).toHaveBeenCalledWith("realm-1", "qbo-1");
  });
});

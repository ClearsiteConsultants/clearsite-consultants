import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyQuickBooksOAuthStateMock = vi.fn();
const exchangeCodeForTokensMock = vi.fn();
const upsertQuickBooksConnectionMock = vi.fn();

vi.mock("@/lib/quickbooks", () => ({
  verifyQuickBooksOAuthState: verifyQuickBooksOAuthStateMock,
  exchangeCodeForTokens: exchangeCodeForTokensMock,
}));

vi.mock("@/lib/db", () => ({
  upsertQuickBooksConnection: upsertQuickBooksConnectionMock,
}));

import { GET } from "@/app/api/integrations/quickbooks/callback/route";

describe("GET /api/integrations/quickbooks/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes callback oauth errors", async () => {
    const req = new NextRequest("http://localhost:3000/api/integrations/quickbooks/callback?error=totally_unknown");

    const res = await GET(req);

    expect(res.headers.get("location")).toContain("reason=auth_error");
  });

  it("stores tokens and redirects on successful authorization", async () => {
    verifyQuickBooksOAuthStateMock.mockReturnValue({ userId: "admin:1", ts: Date.now() });
    exchangeCodeForTokensMock.mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "bearer",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/integrations/quickbooks/callback?code=c&realmId=r&state=signed"
    );

    const res = await GET(req);

    expect(upsertQuickBooksConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        realmId: "r",
        accessToken: "access",
        refreshToken: "refresh",
      })
    );
    expect(res.headers.get("location")).toContain("/admin/invoices?qbo=connected");
  });

  it("returns sanitized token exchange failure reason", async () => {
    verifyQuickBooksOAuthStateMock.mockReturnValue({ userId: "admin:1", ts: Date.now() });
    exchangeCodeForTokensMock.mockRejectedValue(new Error("raw_intuit_payload_here"));

    const req = new NextRequest(
      "http://localhost:3000/api/integrations/quickbooks/callback?code=c&realmId=r&state=signed"
    );

    const res = await GET(req);

    expect(res.headers.get("location")).toContain("reason=token_exchange_failed");
    expect(res.headers.get("location")).not.toContain("raw_intuit_payload_here");
  });
});

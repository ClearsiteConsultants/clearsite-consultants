import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getQuickBooksConnectionMock,
  upsertQuickBooksConnectionMock,
  setQuickBooksConnectionAuthStateMock,
} = vi.hoisted(() => ({
  getQuickBooksConnectionMock: vi.fn(),
  upsertQuickBooksConnectionMock: vi.fn(),
  setQuickBooksConnectionAuthStateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getQuickBooksConnection: getQuickBooksConnectionMock,
  upsertQuickBooksConnection: upsertQuickBooksConnectionMock,
  setQuickBooksConnectionAuthState: setQuickBooksConnectionAuthStateMock,
}));

import {
  getFreshQuickBooksConnection,
  quickBooksApiRequest,
  QuickBooksReconnectRequiredError,
} from "@/lib/quickbooks";

function baseConnection() {
  return {
    id: 1,
    realm_id: "123",
    access_token: "access",
    refresh_token: "refresh",
    token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    connected_by_user_id: "admin:1",
    reconnect_required: false,
    reconnect_reason: null,
    last_auth_error_code: null,
    last_auth_error_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("lib/quickbooks reconnect-required handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws reconnect-required for missing connection", async () => {
    getQuickBooksConnectionMock.mockResolvedValue(undefined);

    await expect(getFreshQuickBooksConnection()).rejects.toMatchObject({
      reconnectReason: "missing_connection",
    });
  });

  it("marks reconnect-required when refresh token is invalid_grant", async () => {
    const connection = {
      ...baseConnection(),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    getQuickBooksConnectionMock.mockResolvedValue(connection);

    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    );

    await expect(getFreshQuickBooksConnection()).rejects.toBeInstanceOf(QuickBooksReconnectRequiredError);
    expect(setQuickBooksConnectionAuthStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        realmId: "123",
        reconnectRequired: true,
        reconnectReason: "invalid_grant",
      })
    );
  });

  it("marks reconnect-required on API 401 authentication failures", async () => {
    getQuickBooksConnectionMock.mockResolvedValue(baseConnection());
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Fault: {
            type: "AuthenticationFault",
            Error: [{ code: "120", Message: "Authentication failed" }],
          },
        }),
        { status: 401 }
      )
    );

    await expect(quickBooksApiRequest({ method: "GET", path: "/v3/company/123/query" })).rejects.toMatchObject({
      reconnectReason: "api_unauthorized",
    });
    expect(setQuickBooksConnectionAuthStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        realmId: "123",
        reconnectRequired: true,
        reconnectReason: "api_unauthorized",
      })
    );
  });

  it("keeps non-auth API failures as generic errors", async () => {
    getQuickBooksConnectionMock.mockResolvedValue(baseConnection());
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Fault: {
            type: "ValidationFault",
            Error: [{ code: "6000", Message: "Business validation" }],
          },
        }),
        { status: 500 }
      )
    );

    await expect(
      quickBooksApiRequest({ method: "GET", path: "/v3/company/123/query" })
    ).rejects.toThrow("QuickBooks API request failed");
    expect(setQuickBooksConnectionAuthStateMock).not.toHaveBeenCalled();
  });
});

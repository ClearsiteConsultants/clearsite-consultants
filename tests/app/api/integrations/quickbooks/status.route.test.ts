import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getQuickBooksConnectionMock = vi.fn();

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ getQuickBooksConnection: getQuickBooksConnectionMock }));

import { GET } from "@/app/api/integrations/quickbooks/status/route";

describe("GET /api/integrations/quickbooks/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for non-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "client:1", user_type: "client" } });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns minimal reconnect-required state for admin", async () => {
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
    getQuickBooksConnectionMock.mockResolvedValue({
      realm_id: "123",
      reconnect_required: true,
      reconnect_reason: "invalid_grant",
    });

    const res = await GET();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual({
      connected: true,
      reconnectRequired: true,
      reconnectReason: "invalid_grant",
    });
  });
});

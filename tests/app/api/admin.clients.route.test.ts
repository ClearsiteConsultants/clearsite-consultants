import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, sqlMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sqlMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

import { PUT } from "@/app/api/admin/clients/route";

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
});

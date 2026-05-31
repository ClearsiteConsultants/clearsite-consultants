import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  authMock,
  listErrorLogsMock,
  deleteErrorLogsByIdsMock,
  deleteErrorLogsOlderThanDaysMock,
  getErrorLogRetentionConfigMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  listErrorLogsMock: vi.fn(),
  deleteErrorLogsByIdsMock: vi.fn(),
  deleteErrorLogsOlderThanDaysMock: vi.fn(),
  getErrorLogRetentionConfigMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({
  listErrorLogs: listErrorLogsMock,
  deleteErrorLogsByIds: deleteErrorLogsByIdsMock,
  deleteErrorLogsOlderThanDays: deleteErrorLogsOlderThanDaysMock,
  getErrorLogRetentionConfig: getErrorLogRetentionConfigMock,
}));

import { DELETE, GET } from "@/app/api/admin/logs/route";

describe("/api/admin/logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin:1", user_type: "admin" } });
    getErrorLogRetentionConfigMock.mockReturnValue({ days: 30, maxRetained: 150 });
  });

  it("rejects non-admin access", async () => {
    authMock.mockResolvedValue({ user: { id: "client:1", user_type: "client" } });

    const res = await GET(new NextRequest("http://localhost:3000/api/admin/logs"));

    expect(res.status).toBe(401);
  });

  it("returns paginated logs for admins", async () => {
    listErrorLogsMock.mockResolvedValue({
      rows: [{ id: 1, route: "/api/invoices", method: "POST", error_message: "boom" }],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    const res = await GET(new NextRequest("http://localhost:3000/api/admin/logs?page=1&pageSize=50"));
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.total).toBe(1);
    expect(payload.retention).toEqual({ days: 30, maxRetained: 150 });
    expect(listErrorLogsMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }));
  });

  it("deletes selected ids", async () => {
    deleteErrorLogsByIdsMock.mockResolvedValue(2);
    deleteErrorLogsOlderThanDaysMock.mockResolvedValue(0);

    const req = new NextRequest("http://localhost:3000/api/admin/logs", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [1, 2] }),
    });

    const res = await DELETE(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.deletedByIds).toBe(2);
    expect(deleteErrorLogsByIdsMock).toHaveBeenCalledWith([1, 2]);
  });

  it("purges older-than-days entries", async () => {
    deleteErrorLogsByIdsMock.mockResolvedValue(0);
    deleteErrorLogsOlderThanDaysMock.mockResolvedValue(4);

    const req = new NextRequest("http://localhost:3000/api/admin/logs", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteOlderThanDays: 30 }),
    });

    const res = await DELETE(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.deletedOlderThanDays).toBe(4);
    expect(deleteErrorLogsOlderThanDaysMock).toHaveBeenCalledWith(30);
  });
});

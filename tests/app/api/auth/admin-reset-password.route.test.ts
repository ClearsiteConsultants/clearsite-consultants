import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  authMock,
  getClientByEmailMock,
  getClientByIdMock,
  hashPasswordMock,
  isAdminSessionMock,
  updateClientPasswordByEmailMock,
  updateClientPasswordByIdMock,
  validatePasswordPolicyMock,
  verifyPasswordMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getClientByEmailMock: vi.fn(),
  getClientByIdMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  isAdminSessionMock: vi.fn(),
  updateClientPasswordByEmailMock: vi.fn(),
  updateClientPasswordByIdMock: vi.fn(),
  validatePasswordPolicyMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  auth: authMock,
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminSession: isAdminSessionMock,
}));

vi.mock("@/lib/db", () => ({
  getClientByEmail: getClientByEmailMock,
  getClientById: getClientByIdMock,
  updateClientPasswordByEmail: updateClientPasswordByEmailMock,
  updateClientPasswordById: updateClientPasswordByIdMock,
}));

vi.mock("@/lib/password-policy", () => ({
  validatePasswordPolicy: validatePasswordPolicyMock,
}));

vi.mock("@/lib/password-utils", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock,
}));

import { POST } from "@/app/api/auth/admin-reset-password/route";

describe("/api/auth/admin-reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "user:1", email: "admin@example.com" },
    });
    isAdminSessionMock.mockReturnValue(true);
    validatePasswordPolicyMock.mockReturnValue({ valid: true, message: "" });
  });

  it("rejects an admin reset when the new password matches the client's current password", async () => {
    getClientByIdMock.mockResolvedValue({ id: "123", password_hash: "stored-hash" });
    verifyPasswordMock.mockResolvedValue({ valid: true, legacy: false });

    const req = new NextRequest("http://localhost:3000/api/auth/admin-reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "123",
        newPassword: "SecurePassword123!",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("New password must be different from current password");
    expect(getClientByIdMock).toHaveBeenCalledWith("123");
    expect(verifyPasswordMock).toHaveBeenCalledWith("SecurePassword123!", "stored-hash");
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(updateClientPasswordByIdMock).not.toHaveBeenCalled();
  });

  it("hashes and updates the client password when resetting by email", async () => {
    getClientByEmailMock.mockResolvedValue({
      id: "123",
      email: "client@example.com",
      password_hash: "stored-hash",
    });
    verifyPasswordMock.mockResolvedValue({ valid: false, legacy: false });
    hashPasswordMock.mockResolvedValue("new-password-hash");
    updateClientPasswordByEmailMock.mockResolvedValue({
      id: "123",
      email: "client@example.com",
    });

    const req = new NextRequest("http://localhost:3000/api/auth/admin-reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "client@example.com",
        newPassword: "DifferentPassword123!",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(getClientByEmailMock).toHaveBeenCalledWith("client@example.com");
    expect(verifyPasswordMock).toHaveBeenCalledWith("DifferentPassword123!", "stored-hash");
    expect(hashPasswordMock).toHaveBeenCalledWith("DifferentPassword123!");
    expect(updateClientPasswordByEmailMock).toHaveBeenCalledWith(
      "client@example.com",
      "new-password-hash"
    );
    expect(payload.message).toBe("Password reset successfully");
  });
});
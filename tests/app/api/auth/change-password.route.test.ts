import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  authMock,
  getClientByIdMock,
  getUserByIdMock,
  hashPasswordMock,
  updateAdminPasswordByIdMock,
  updateClientPasswordByIdMock,
  validatePasswordPolicyMock,
  verifyPasswordMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getClientByIdMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  updateAdminPasswordByIdMock: vi.fn(),
  updateClientPasswordByIdMock: vi.fn(),
  validatePasswordPolicyMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db", () => ({
  getClientById: getClientByIdMock,
  getUserById: getUserByIdMock,
  updateAdminPasswordById: updateAdminPasswordByIdMock,
  updateClientPasswordById: updateClientPasswordByIdMock,
}));

vi.mock("@/lib/password-policy", () => ({
  validatePasswordPolicy: validatePasswordPolicyMock,
}));

vi.mock("@/lib/password-utils", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock,
}));

import { POST } from "@/app/api/auth/change-password/route";

describe("/api/auth/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    validatePasswordPolicyMock.mockReturnValue({ valid: true, message: "" });
    getClientByIdMock.mockResolvedValue({ id: "123", password_hash: "stored-hash" });
  });

  it("rejects a new password that matches the current password", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "client:123" } });
    verifyPasswordMock
      .mockResolvedValueOnce({ valid: true, legacy: false })
      .mockResolvedValueOnce({ valid: true, legacy: false });

    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "SecurePassword123!",
        newPassword: "SecurePassword123!",
        confirmPassword: "SecurePassword123!",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("New password must be different from current password");
    expect(verifyPasswordMock).toHaveBeenCalledWith(
      "SecurePassword123!",
      "stored-hash"
    );
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(updateClientPasswordByIdMock).not.toHaveBeenCalled();
  });

  it("hashes and persists the new password after validating the current password", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "client:123" } });
    
    // With our new behavior, session does NOT bypass current password requirement if no sec_token is provided.
    // So verifyPassword should be called for currentPassword check (must be valid, i.e., true)
    // and then called for isSamePassword check (must be invalid, i.e., false).
    verifyPasswordMock.mockReset();
    verifyPasswordMock
      .mockResolvedValueOnce({ valid: true, legacy: false })
      .mockResolvedValueOnce({ valid: false, legacy: false }); 
    
    hashPasswordMock.mockResolvedValue("new-password-hash");
    updateClientPasswordByIdMock.mockResolvedValue({ id: "123" });

    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "CurrentPassword123!",
        newPassword: "DifferentPassword123!",
        confirmPassword: "DifferentPassword123!",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(hashPasswordMock).toHaveBeenCalledWith("DifferentPassword123!");
    expect(updateClientPasswordByIdMock).toHaveBeenCalledWith("123", "new-password-hash");
    expect(payload.message).toBe("Password updated successfully");
  });
});
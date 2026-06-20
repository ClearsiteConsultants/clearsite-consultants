import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  isEmailInUseMock,
  hashPasswordMock,
  validatePasswordPolicyMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  isEmailInUseMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  validatePasswordPolicyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createClient: createClientMock,
  isEmailInUse: isEmailInUseMock,
}));

vi.mock("@/lib/password-utils", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/password-policy", () => ({
  validatePasswordPolicy: validatePasswordPolicyMock,
}));

import { POST } from "@/app/api/auth/register/route";

describe("/api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEmailInUseMock.mockResolvedValue(false);
    validatePasswordPolicyMock.mockReturnValue({ valid: true, message: "" });
    hashPasswordMock.mockResolvedValue("hashed-password");
    createClientMock.mockResolvedValue({ id: "client-1", email: "client@example.com" });
  });

  it("returns 400 when the password fails policy validation", async () => {
    validatePasswordPolicyMock.mockReturnValue({
      valid: false,
      message:
        "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.",
    });

    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "client@example.com",
        password: "weak",
        company_name: "Clearsite",
        first_name: "Test",
        last_name: "Client",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Password must be at least 12 characters");
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("hashes the password and passes the hashed value to createClient", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "client@example.com",
        password: "SecurePassword123!",
        company_name: "Clearsite",
        first_name: "Test",
        last_name: "Client",
        phone: "555-555-5555",
        domain_name: "example.com",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(hashPasswordMock).toHaveBeenCalledWith("SecurePassword123!");
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "client@example.com",
        password_hash: "hashed-password",
        company_name: "Clearsite",
      })
    );
    expect(payload.client).toEqual({ id: "client-1", email: "client@example.com" });
  });

  it("returns 400 when the email is already in use", async () => {
    isEmailInUseMock.mockResolvedValue(true);

    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "already-taken@example.com",
        password: "SecurePassword123!",
        company_name: "Test Corp",
        first_name: "John",
        last_name: "Doe",
      }),
    });

    const res = await POST(req);
    const payload = await res.json();
    expect(res.status).toBe(400);
    expect(payload.error).toBe("This email address is already in use.");
    expect(isEmailInUseMock).toHaveBeenCalledWith("already-taken@example.com");
  });
});
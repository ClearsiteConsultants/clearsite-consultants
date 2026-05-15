import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hashPassword,
  prehashPassword,
  verifyPassword,
} from "@/lib/password-utils";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

describe("lib/password-utils", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret";
  });

  afterEach(() => {
    if (originalAuthSecret) {
      process.env.AUTH_SECRET = originalAuthSecret;
    } else {
      delete process.env.AUTH_SECRET;
    }

    if (originalNextAuthSecret) {
      process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
    } else {
      delete process.env.NEXTAUTH_SECRET;
    }
  });

  it("hashes and verifies passwords using the modern prehash flow", async () => {
    const password = "SecurePassword123!";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toEqual({
      valid: true,
      legacy: false,
    });
  });

  it("identifies legacy bcrypt hashes so callers can upgrade them", async () => {
    const password = "SecurePassword123!";
    const legacyHash = await bcrypt.hash(password, 10);

    await expect(verifyPassword(password, legacyHash)).resolves.toEqual({
      valid: true,
      legacy: true,
    });
  });

  it("returns invalid for wrong passwords and malformed hashes", async () => {
    const password = "SecurePassword123!";
    const passwordHash = await hashPassword(password);

    await expect(verifyPassword("WrongPassword!", passwordHash)).resolves.toEqual({
      valid: false,
      legacy: false,
    });

    await expect(verifyPassword(password, "invalid-hash")).resolves.toEqual({
      valid: false,
      legacy: false,
    });
  });

  it("requires an auth secret for password prehashing", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    expect(() => prehashPassword("SecurePassword123!")).toThrow(
      "AUTH_SECRET is required for password hashing"
    );
  });
});
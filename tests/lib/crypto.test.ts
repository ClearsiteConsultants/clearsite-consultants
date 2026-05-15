import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decryptToken, encryptToken, isEncryptedToken } from "@/lib/crypto";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.QBO_TOKEN_ENCRYPTION_KEY;

describe("lib/crypto", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = "test";
    delete process.env.QBO_TOKEN_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalEncryptionKey) {
      process.env.QBO_TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
    } else {
      delete process.env.QBO_TOKEN_ENCRYPTION_KEY;
    }
  });

  it("encrypts and decrypts tokens when an encryption key is configured", () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_KEY;

    const plaintext = "test-token";
    const encrypted = encryptToken(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(isEncryptedToken(encrypted)).toBe(true);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("falls back to plaintext and warns when no key is configured outside production", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const plaintext = "test-token";
    const encrypted = encryptToken(plaintext);

    expect(encrypted).toBe(plaintext);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("QBO_TOKEN_ENCRYPTION_KEY is not set")
    );
  });

  it("returns plaintext values unchanged when they are not encrypted", () => {
    expect(decryptToken("plain-token")).toBe("plain-token");
    expect(isEncryptedToken("plain-token")).toBe(false);
  });

  it("throws for malformed encrypted token payloads", () => {
    process.env.QBO_TOKEN_ENCRYPTION_KEY = TEST_KEY;

    expect(() => decryptToken("enc:v1:invalid-data")).toThrow(
      "Invalid encrypted token format"
    );
  });

  it("requires an encryption key in production", () => {
    process.env.NODE_ENV = "production";

    expect(() => encryptToken("test-token")).toThrow(
      "QBO_TOKEN_ENCRYPTION_KEY must be set in production to encrypt OAuth tokens"
    );
  });
});
import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "../lib/crypto";

describe("Token Encryption", () => {
  it("should encrypt and decrypt a token correctly", () => {
    const plaintext = "test-token";
    const encrypted = encryptToken(plaintext);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("should handle unencrypted tokens gracefully in development", () => {
    const plaintext = "test-token";
    const decrypted = decryptToken(plaintext);

    expect(decrypted).toBe(plaintext);
  });

  it("should throw an error for invalid encrypted tokens", () => {
    const invalidToken = "enc:v1:invalid-data";

    expect(() => decryptToken(invalidToken)).toThrow();
  });
});
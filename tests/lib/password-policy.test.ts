import { describe, expect, it } from "vitest";

import {
  PASSWORD_POLICY_MESSAGE,
  validatePasswordPolicy,
} from "@/lib/password-policy";

describe("lib/password-policy", () => {
  it("accepts passwords that satisfy every policy rule", () => {
    expect(validatePasswordPolicy("SecurePassword123!")).toEqual({
      valid: true,
      message: "",
    });
  });

  it.each([
    "Short1!",
    "lowercaseonly123!",
    "UPPERCASEONLY123!",
    "NoNumbersHere!!",
    "NoSymbolsHere123",
  ])("rejects invalid password %s with the shared policy message", (password) => {
    expect(validatePasswordPolicy(password)).toEqual({
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
  });
});
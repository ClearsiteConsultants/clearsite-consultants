const MIN_PASSWORD_LENGTH = 12;

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SYMBOL_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.";

export function validatePasswordPolicy(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  if (!UPPERCASE_REGEX.test(password)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  if (!LOWERCASE_REGEX.test(password)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  if (!NUMBER_REGEX.test(password)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  if (!SYMBOL_REGEX.test(password)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  return { valid: true, message: "" };
}

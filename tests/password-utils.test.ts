import { describe, test, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/password-utils';

process.env.AUTH_SECRET = 'test-secret';

describe('Password Utilities', () => {
  test('should hash and validate a password correctly', async () => {
    const password = 'SecurePassword123!';
    const hashedPassword = await hashPassword(password);

    expect(await verifyPassword(password, hashedPassword)).toEqual({ valid: true, legacy: false });
  });

  test('should fail validation for incorrect password', async () => {
    const password = 'SecurePassword123!';
    const hashedPassword = await hashPassword(password);

    expect(await verifyPassword('WrongPassword!', hashedPassword)).toEqual({ valid: false, legacy: false });
  });

  test('should throw an error for invalid hash format', async () => {
    const password = 'SecurePassword123!';
    const invalidHash = 'invalid-hash';

    await expect(verifyPassword(password, invalidHash)).resolves.toEqual({ valid: false, legacy: false });
  });
});
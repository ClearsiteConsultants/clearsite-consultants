import { afterEach } from "vitest";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-nextauth-secret";
process.env.QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || "test-client-id";
process.env.QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || "test-client-secret";
process.env.QUICKBOOKS_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || "http://localhost:3000/callback";
process.env.QUICKBOOKS_DEFAULT_ITEM_ID = process.env.QUICKBOOKS_DEFAULT_ITEM_ID || "1";

afterEach(() => {
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

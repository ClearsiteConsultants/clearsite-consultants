import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "lib/crypto.ts",
        "lib/password-policy.ts",
        "lib/password-utils.ts",
        "lib/quickbooks.ts",
        "lib/quickbooks-sync.ts",
        "app/api/auth/register/route.ts",
        "app/api/auth/change-password/route.ts",
        "app/api/auth/admin-reset-password/route.ts",
        "app/api/integrations/quickbooks/callback/route.ts",
        "app/api/integrations/quickbooks/status/route.ts",
        "app/api/invoices/route.ts",
        "app/api/invoices/[id]/sync/route.ts",
      ],
    },
  },
});

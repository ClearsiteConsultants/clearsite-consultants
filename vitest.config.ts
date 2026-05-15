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
        "lib/quickbooks.ts",
        "lib/quickbooks-sync.ts",
        "app/api/integrations/quickbooks/callback/route.ts",
        "app/api/integrations/quickbooks/status/route.ts",
        "app/api/invoices/route.ts",
        "app/api/invoices/[id]/sync/route.ts",
      ],
    },
  },
});

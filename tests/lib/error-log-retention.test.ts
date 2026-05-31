import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = {
  text: string;
  values: unknown[];
};

const harness = vi.hoisted(() => {
  const queryCalls: QueryCall[] = [];

  const reset = () => {
    queryCalls.length = 0;
  };

  const dbMock = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sqlText = strings.join(" ").replace(/\s+/g, " ").trim();
    queryCalls.push({ text: sqlText, values });

    if (sqlText.includes("INSERT INTO error_logs")) {
      return [
        {
          id: 999,
          level: "error",
          route: "/api/admin/sync",
          method: "POST",
          status_code: 500,
          error_name: "SyncFailure",
          error_message: "sync failed",
          error_stack: null,
          user_id: "admin:1",
          user_type: "admin",
          metadata: null,
          created_at: "2026-05-30T00:00:00.000Z",
        },
      ];
    }

    return [];
  });

  const postgresFactoryMock = vi.fn(() => dbMock);

  return {
    queryCalls,
    reset,
    dbMock,
    postgresFactoryMock,
  };
});

vi.mock("postgres", () => ({
  default: harness.postgresFactoryMock,
}));

import { createErrorLog, getErrorLogRetentionConfig } from "@/lib/db";

describe("lib/db error log retention cleanup", () => {
  beforeEach(() => {
    harness.reset();
    vi.clearAllMocks();
  });

  it("uses the centralized retention config", () => {
    expect(getErrorLogRetentionConfig()).toEqual({ days: 30, maxRetained: 150 });
  });

  it("runs duplicate collapse during error log writes and keeps newest by ranking", async () => {
    await createErrorLog({
      route: "/api/admin/sync",
      method: "POST",
      statusCode: 500,
      errorName: "SyncFailure",
      errorMessage: "sync failed",
      userId: "admin:1",
      userType: "admin",
    });

    const duplicateCleanup = harness.queryCalls.find((call) =>
      call.text.includes("WITH ranked_duplicates AS")
    );

    expect(duplicateCleanup).toBeDefined();
    expect(duplicateCleanup?.text).toContain("ROW_NUMBER() OVER");
    expect(duplicateCleanup?.text).toContain("ORDER BY created_at DESC, id DESC");
    expect(duplicateCleanup?.text).toContain("WHERE duplicate_rank > 1");
  });

  it("runs duplicate cleanup before oldest pruning and prunes with maxRetained", async () => {
    await createErrorLog({
      route: "/api/admin/sync",
      method: "POST",
      statusCode: 500,
      errorName: "SyncFailure",
      errorMessage: "sync failed",
      userId: "admin:1",
      userType: "admin",
    });

    const ageCleanupIndex = harness.queryCalls.findIndex((call) =>
      call.text.includes("DELETE FROM error_logs") && call.text.includes("created_at < NOW()")
    );
    const duplicateCleanupIndex = harness.queryCalls.findIndex((call) =>
      call.text.includes("WITH ranked_duplicates AS")
    );
    const oldestPruneIndex = harness.queryCalls.findIndex((call) =>
      call.text.includes("OFFSET") && call.text.includes("ORDER BY created_at DESC, id DESC")
    );

    expect(ageCleanupIndex).toBeGreaterThan(-1);
    expect(duplicateCleanupIndex).toBeGreaterThan(-1);
    expect(oldestPruneIndex).toBeGreaterThan(-1);
    expect(duplicateCleanupIndex).toBeGreaterThan(ageCleanupIndex);
    expect(oldestPruneIndex).toBeGreaterThan(duplicateCleanupIndex);

    const pruneQuery = harness.queryCalls[oldestPruneIndex];
    expect(pruneQuery.values).toContain(150);
  });
});

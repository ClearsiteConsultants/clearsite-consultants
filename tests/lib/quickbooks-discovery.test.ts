import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getQuickBooksConnectionMock,
  upsertQuickBooksConnectionMock,
  setQuickBooksConnectionAuthStateMock,
} = vi.hoisted(() => ({
  getQuickBooksConnectionMock: vi.fn(),
  upsertQuickBooksConnectionMock: vi.fn(),
  setQuickBooksConnectionAuthStateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getQuickBooksConnection: getQuickBooksConnectionMock,
  upsertQuickBooksConnection: upsertQuickBooksConnectionMock,
  setQuickBooksConnectionAuthState: setQuickBooksConnectionAuthStateMock,
}));

describe("lib/quickbooks discovery document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    process.env.QUICKBOOKS_CLIENT_ID = "test-client";
    process.env.QUICKBOOKS_CLIENT_SECRET = "test-secret";
    process.env.QUICKBOOKS_REDIRECT_URI = "http://localhost:3000/api/integrations/quickbooks/callback";
    process.env.AUTH_SECRET = "test-secret";
    process.env.DISCOVERY_CACHE_TTL_MINUTES = "30";
    // Clear module cache to reset discovery endpoint cache
    vi.resetModules();
  });

  it("buildQuickBooksAuthorizeUrl uses discovered authorization_endpoint when available", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    const mockDiscovery = {
      authorization_endpoint: "https://appcenter.intuit.com/connect/oauth2",
      token_endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    };

    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockDiscovery), { status: 200 })
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
    expect(url).toContain("client_id=test-client");
    expect(url).toContain("state=test-state");
  });

  it("buildQuickBooksAuthorizeUrl falls back to hardcoded endpoint when discovery fails", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockRejectedValue(
      new Error("Network error")
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
    expect(url).toContain("client_id=test-client");
  });

  it("buildQuickBooksAuthorizeUrl falls back when discovered endpoint has invalid hostname", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    const maliciousDiscovery = {
      authorization_endpoint: "https://attacker.com/oauth2",
      token_endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    };

    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(maliciousDiscovery), { status: 200 })
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
    expect(url).not.toContain("attacker.com");
  });

  it("buildQuickBooksAuthorizeUrl falls back when discovered endpoint is not HTTPS", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    const insecureDiscovery = {
      authorization_endpoint: "http://appcenter.intuit.com/connect/oauth2",
      token_endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    };

    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(insecureDiscovery), { status: 200 })
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
    expect(url).not.toContain("http://");
  });

  it("buildQuickBooksAuthorizeUrl uses sandbox discovery endpoint in sandbox environment", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    let discoveryUrl = "";
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockImplementation((url: string) => {
      discoveryUrl = url;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            authorization_endpoint: "https://appcenter.intuit.com/connect/oauth2",
            token_endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
          }),
          { status: 200 }
        )
      );
    });

    await buildQuickBooksAuthorizeUrl("test-state");

    expect(discoveryUrl).toContain("openid_sandbox_configuration");
  });

  it("buildQuickBooksAuthorizeUrl uses production discovery endpoint in production environment", async () => {
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    let discoveryUrl = "";
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockImplementation((url: string) => {
      discoveryUrl = url;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            authorization_endpoint: "https://appcenter.intuit.com/connect/oauth2",
            token_endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
          }),
          { status: 200 }
        )
      );
    });

    await buildQuickBooksAuthorizeUrl("test-state");

    expect(discoveryUrl).toContain("openid_configuration");
    expect(discoveryUrl).not.toContain("sandbox");
  });

  it("falls back gracefully when discovery document response is missing required fields", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ issuer: "https://oauth.platform.intuit.com/op/v1" }),
        { status: 200 }
      )
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
  });

  it("falls back gracefully when discovery document endpoint request times out", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError")
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
  });

  it("falls back gracefully when discovery document response is not JSON", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response("<html>Error</html>", { status: 200 })
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
  });

  it("falls back gracefully when discovery document request returns error status", async () => {
    const { buildQuickBooksAuthorizeUrl } = await import("@/lib/quickbooks");
    
    (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );

    const url = await buildQuickBooksAuthorizeUrl("test-state");

    expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
  });

  it("validates that discovered endpoints are whitelisted domains", async () => {
    const testCases = [
      {
        name: "accepts appcenter.intuit.com",
        endpoint: "https://appcenter.intuit.com/connect/oauth2",
        shouldUse: true,
      },
      {
        name: "accepts oauth.platform.intuit.com",
        endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        shouldUse: true,
      },
      {
        name: "accepts oauth.intuit.com",
        endpoint: "https://oauth.intuit.com/oauth2/v1/tokens/bearer",
        shouldUse: true,
      },
      {
        name: "rejects arbitrary domains",
        endpoint: "https://evil.com/oauth2",
        shouldUse: false,
      },
    ];

    for (const testCase of testCases) {
      vi.resetModules();
      process.env.DISCOVERY_CACHE_TTL_MINUTES = "30";
      
      (globalThis as { fetch?: typeof fetch }).fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            authorization_endpoint: testCase.endpoint,
            token_endpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
          }),
          { status: 200 }
        )
      );

      const { buildQuickBooksAuthorizeUrl: buildUrl } = await import("@/lib/quickbooks");
      const url = await buildUrl("test-state");

      if (testCase.shouldUse) {
        expect(url).toContain(testCase.endpoint.split("?")[0]);
      } else {
        expect(url).toContain("https://appcenter.intuit.com/connect/oauth2");
      }
    }
  });
});

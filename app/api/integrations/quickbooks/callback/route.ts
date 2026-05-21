import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, verifyQuickBooksOAuthState } from "@/lib/quickbooks";
import { upsertQuickBooksConnection } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";

/**
 * Allowlist of reason codes that may be surfaced to the UI.
 * Any error not in this list is replaced with the generic fallback so that
 * internal error messages are never propagated to the browser.
 */
const ALLOWED_ERROR_REASONS = new Set([
  "access_denied",
  "invalid_scope",
  "missing_params",
  "invalid_state",
  "token_exchange_failed",
  "server_error",
  "temporarily_unavailable",
]);

const GENERIC_ERROR_REASON = "auth_error";

function sanitizeReason(raw: string): string {
  return ALLOWED_ERROR_REASONS.has(raw) ? raw : GENERIC_ERROR_REASON;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    const reason = sanitizeReason(oauthError);
    return NextResponse.redirect(new URL(`/admin/invoices?qbo=error&reason=${encodeURIComponent(reason)}`, req.url));
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(new URL("/admin/invoices?qbo=error&reason=missing_params", req.url));
  }

  const statePayload = verifyQuickBooksOAuthState(state);
  if (!statePayload) {
    return NextResponse.redirect(new URL("/admin/invoices?qbo=error&reason=invalid_state", req.url));
  }

  try {
    const tokenPayload = await exchangeCodeForTokens(code);
    await upsertQuickBooksConnection({
      realmId,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenPayload.expires_in * 1000),
      connectedByUserId: statePayload.userId,
    });

    return NextResponse.redirect(new URL("/admin/invoices?qbo=connected", req.url));
  } catch (error: unknown) {
    // Log only the error category to avoid leaking OAuth payload details.
    const errSummary = error instanceof Error ? error.name : "UnknownError";
    console.error("QuickBooks token exchange failed:", errSummary);
    await persistApiError({
      route: "/api/integrations/quickbooks/callback",
      method: "GET",
      statusCode: 500,
      error,
      metadata: { realmId, hasCode: Boolean(code), hasState: Boolean(state) },
    });
    return NextResponse.redirect(new URL("/admin/invoices?qbo=error&reason=token_exchange_failed", req.url));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, verifyQuickBooksOAuthState } from "@/lib/quickbooks";
import { upsertQuickBooksConnection } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/admin/invoices?qbo=error&reason=${encodeURIComponent(oauthError)}`, req.url));
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
    const reason = error instanceof Error ? error.message : "token_exchange_failed";
    return NextResponse.redirect(new URL(`/admin/invoices?qbo=error&reason=${encodeURIComponent(reason)}`, req.url));
  }
}

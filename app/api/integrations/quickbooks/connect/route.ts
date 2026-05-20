import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { buildQuickBooksAuthorizeUrl, createQuickBooksOAuthState } from "@/lib/quickbooks";

export async function GET() {
  const session = await auth();
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  if (!session?.user?.id || userType !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = createQuickBooksOAuthState(session.user.id);
  const url = await buildQuickBooksAuthorizeUrl(state);
  return NextResponse.redirect(url);
}

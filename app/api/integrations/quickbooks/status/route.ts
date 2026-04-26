import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getQuickBooksConnection } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  if (!session?.user?.id || userType !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    realmId: connection.realm_id,
    tokenExpiresAt: connection.token_expires_at,
    connectedByUserId: connection.connected_by_user_id,
    updatedAt: connection.updated_at,
  });
}

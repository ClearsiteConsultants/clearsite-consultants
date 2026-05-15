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

  return NextResponse.json(
    {
      connected: Boolean(connection),
      reconnectRequired: Boolean(connection?.reconnect_required),
      reconnectReason: connection?.reconnect_reason || null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

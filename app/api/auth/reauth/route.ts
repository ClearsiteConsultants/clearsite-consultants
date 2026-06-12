import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getClientByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/password-utils";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const rawUserId = session?.user?.id;

    if (!rawUserId || !rawUserId.startsWith("client:")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Verify the email matches the session email for security
    if (session.user?.email !== email) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const client = await getClientByEmail(email);
    if (!client || !client.password_hash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { valid } = await verifyPassword(password, client.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({ message: "Re-authenticated successfully" });
  } catch (error: unknown) {
    console.error("Re-auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

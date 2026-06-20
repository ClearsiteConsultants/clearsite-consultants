import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/crypto";
import { sql, isEmailInUse } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";

export async function POST(request: Request) {
  try {
    const { sec_token, email } = await request.json();

    if (!sec_token) {
      return NextResponse.json({ error: "Security token is required." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    let payload;
    try {
      const decrypted = decryptToken(sec_token);
      payload = JSON.parse(decrypted);
    } catch {
      return NextResponse.json({ error: "Invalid security token." }, { status: 400 });
    }

    const { userId, timestamp } = payload;

    if (!userId || !timestamp) {
      return NextResponse.json({ error: "Malformed security token." }, { status: 400 });
    }

    // Token expires after 24 hours
    const now = Date.now();
    const age = now - timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Security token has expired." }, { status: 400 });
    }

    // Check if the new email is already in use
    if (await isEmailInUse(email, userId)) {
      return NextResponse.json({ error: "This email address is already in use." }, { status: 400 });
    }

    // Update the email in the DB
    await sql`
      UPDATE clients
      SET email = ${email}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return NextResponse.json({ success: true, message: "Email updated successfully." });
  } catch (error: unknown) {
    await persistApiError({
      route: "/api/auth/change-email",
      method: "POST",
      statusCode: 500,
      error,
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";

function parseClientId(sessionUserId: string) {
  if (sessionUserId.startsWith("client:")) {
    return sessionUserId.slice("client:".length);
  }
  return null;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any)?.user_type !== "client") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = parseClientId(session.user.id as string);
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sql`
      SELECT id, email, company_name, domain_name, plan, service_status, next_invoice_due
      FROM clients
      WHERE id = ${clientId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

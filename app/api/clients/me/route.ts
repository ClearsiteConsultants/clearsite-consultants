import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql, updateClientBillingAddress } from "@/lib/db";
import { syncClientInvoicesFromQuickBooks } from "@/lib/quickbooks-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseClientId(sessionUserId: string) {
  if (sessionUserId.startsWith("client:")) {
    return sessionUserId.slice("client:".length);
  }
  return sessionUserId;
}

export async function GET() {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session?.user?.id || userType !== "client") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = parseClientId(session.user.id as string);
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await syncClientInvoicesFromQuickBooks(clientId);
    } catch {
      // Fall back to local client data when QuickBooks sync is unavailable.
    }

    const result = await sql`
      SELECT id, email, company_name, first_name, last_name, domain_name, plan, service_status, next_invoice_due,
             billing_address_line1, billing_address_line2, billing_address_city, billing_address_state, billing_address_zip, billing_address_country
      FROM clients
      WHERE id = ${clientId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session?.user?.id || userType !== "client") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = parseClientId(session.user.id as string);
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      billing_address_line1,
      billing_address_line2,
      billing_address_city,
      billing_address_state,
      billing_address_zip,
      billing_address_country,
    } = body;

    const updated = await updateClientBillingAddress(clientId, {
      billing_address_line1: billing_address_line1 || null,
      billing_address_line2: billing_address_line2 || null,
      billing_address_city: billing_address_city || null,
      billing_address_state: billing_address_state || null,
      billing_address_zip: billing_address_zip || null,
      billing_address_country: billing_address_country || null,
    });

    if (!updated) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getQuickBooksConnection, sql, updateClientBillingAddress } from "@/lib/db";
import { updateQuickBooksCustomerBillingAddress } from "@/lib/quickbooks";
import { syncClientInvoicesFromQuickBooks } from "@/lib/quickbooks-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BillingAddressPayload = {
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
};

function parseClientId(sessionUserId: string) {
  if (sessionUserId.startsWith("client:")) {
    return sessionUserId.slice("client:".length);
  }
  return sessionUserId;
}

function normalizeTextField(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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
      SELECT
        id,
        email,
        company_name,
        first_name,
        last_name,
        domain_name,
        plan,
        service_status,
        next_invoice_due,
        qbo_customer_id,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postal_code,
        billing_country
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

async function updateBillingAddress(request: Request) {
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
    const payload = await request.json() as BillingAddressPayload;

    const updatedClient = await updateClientBillingAddress(clientId, {
      billing_address_line1: normalizeTextField(payload.billing_address_line1),
      billing_address_line2: normalizeTextField(payload.billing_address_line2),
      billing_city: normalizeTextField(payload.billing_city),
      billing_state: normalizeTextField(payload.billing_state),
      billing_postal_code: normalizeTextField(payload.billing_postal_code),
      billing_country: normalizeTextField(payload.billing_country),
    });

    if (!updatedClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    let warning: string | null = null;

    if (updatedClient.qbo_customer_id) {
      try {
        const connection = await getQuickBooksConnection();
        if (connection) {
          await updateQuickBooksCustomerBillingAddress(connection.realm_id, String(updatedClient.qbo_customer_id), {
            line1: updatedClient.billing_address_line1 || undefined,
            line2: updatedClient.billing_address_line2 || undefined,
            city: updatedClient.billing_city || undefined,
            countrySubDivisionCode: updatedClient.billing_state || undefined,
            postalCode: updatedClient.billing_postal_code || undefined,
            country: updatedClient.billing_country || undefined,
          });
        } else {
          warning = "Billing address was saved, but QuickBooks sync is unavailable right now.";
        }
      } catch {
        warning = "Billing address was saved, but QuickBooks sync could not be completed.";
      }
    }

    return NextResponse.json({
      ...updatedClient,
      warning,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return updateBillingAddress(request);
}

export async function PATCH(request: Request) {
  return updateBillingAddress(request);
}

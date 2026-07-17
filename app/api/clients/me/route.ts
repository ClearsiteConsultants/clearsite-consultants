import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { 
  getQuickBooksConnection, 
  sql, 
  updateClientBillingAddress, 
  updateClientAccountInfo, 
  getClientById,
  isEmailInUse
} from "@/lib/db";
import { updateQuickBooksCustomerBillingAddress } from "@/lib/quickbooks";
import { syncClientInvoicesFromQuickBooks } from "@/lib/quickbooks-sync";
import { persistApiError } from "@/lib/error-logger";
import { BILLING_FIELD_LIMITS, ACCOUNT_INFO_FIELD_LIMITS } from "@/lib/field-limits";
import { verifyPassword } from "@/lib/password-utils";
import { encryptToken } from "@/lib/crypto";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BillingAddressPayload = {
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postal_code?: string | null;
};

type AccountInfoPayload = {
  company_name?: string;
  phone?: string | null;
  email?: string;
  currentPassword?: string;
};

function parseClientId(sessionUserId: string) {
  const normalized = sessionUserId.trim();
  for (const prefix of ["client:", "client_", "client-"]) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

function normalizeTextField(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isMissingBillingColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /column .*billing_(address_line1|address_line2|city|state|postal_code|country).* does not exist/i.test(
    error.message
  );
}

function isMissingClientProfileColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /column .*\b(domain_name|plan|service_status|maintenance_fee_frequency|next_invoice_due|service_start_date|qbo_customer_id|first_name|last_name)\b.* does not exist/i.test(
    error.message
  );
}

function isMissingClientColumnError(error: unknown) {
  return isMissingBillingColumnError(error) || isMissingClientProfileColumnError(error);
}

async function ensureClientProfileColumns() {
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS domain_name VARCHAR(255)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS plan VARCHAR(100)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS service_status VARCHAR(50) DEFAULT NULL
  `;
  await sql`
    ALTER TABLE clients
    ALTER COLUMN service_status SET DEFAULT NULL
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS maintenance_fee_frequency VARCHAR(50) DEFAULT 'Monthly'
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS next_invoice_due DATE
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS client_status VARCHAR(50) DEFAULT 'Active'
  `;
  await sql`
    ALTER TABLE clients
    ALTER COLUMN client_status SET DEFAULT 'Active'
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS qbo_customer_id VARCHAR(64)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS service_start_date DATE
  `;
}

async function ensureBillingAddressColumns() {
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS billing_address_line1 VARCHAR(255)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS billing_address_line2 VARCHAR(255)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS billing_city VARCHAR(255)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS billing_state VARCHAR(255)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(50)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2) DEFAULT 'US'
  `;
}

async function getClientProfile(clientId: string) {
  try {
    const result = await sql`
      SELECT
        id,
        email,
        company_name,
        first_name,
        last_name,
        phone,
        domain_name,
        plan,
        service_status,
        maintenance_fee_frequency,
        next_invoice_due,
        service_start_date,
        qbo_customer_id,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postal_code
      FROM clients
      WHERE id = ${clientId}
      LIMIT 1
    `;
    return result.rows[0] ?? null;
  } catch (error) {
    if (!isMissingClientColumnError(error)) {
      throw error;
    }

    await ensureClientProfileColumns();
    await ensureBillingAddressColumns();

    const retry = await sql`
      SELECT
        id,
        email,
        company_name,
        first_name,
        last_name,
        phone,
        domain_name,
        plan,
        service_status,
        maintenance_fee_frequency,
        next_invoice_due,
        service_start_date,
        qbo_customer_id,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postal_code
      FROM clients
      WHERE id = ${clientId}
      LIMIT 1
    `;

    return retry.rows[0] ?? null;
  }
}

export async function GET() {
  let sessionUserId: string | null = null;
  let sessionUserType: string | null = null;
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session?.user?.id || userType !== "client") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = parseClientId(session.user.id as string);
    sessionUserId = String(session.user.id);
    sessionUserType = userType ?? null;
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await syncClientInvoicesFromQuickBooks(clientId, {
        origin: "portal-read",
        route: "/api/clients/me",
        method: "GET",
      });
    } catch {
      // Fall back to local client data when QuickBooks sync is unavailable.
    }

    const clientProfile = await getClientProfile(clientId);
    if (!clientProfile) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(clientProfile, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    await persistApiError({
      route: "/api/clients/me",
      method: "GET",
      statusCode: 500,
      userId: sessionUserId,
      userType: sessionUserType,
      error,
    });
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

    const normalizedPayload = {
      billing_address_line1: normalizeTextField(payload.billing_address_line1),
      billing_address_line2: normalizeTextField(payload.billing_address_line2),
      billing_city: normalizeTextField(payload.billing_city),
      billing_state: normalizeTextField(payload.billing_state),
      billing_postal_code: normalizeTextField(payload.billing_postal_code),
      billing_country: 'US',
    };

    // Server-side validation
    const errors: string[] = [];
    if (normalizedPayload.billing_address_line1 && normalizedPayload.billing_address_line1.length > BILLING_FIELD_LIMITS.billing_address_line1) {
      errors.push(`Address Line 1 exceeds maximum length of ${BILLING_FIELD_LIMITS.billing_address_line1} characters.`);
    }
    if (normalizedPayload.billing_address_line2 && normalizedPayload.billing_address_line2.length > BILLING_FIELD_LIMITS.billing_address_line2) {
      errors.push(`Address Line 2 exceeds maximum length of ${BILLING_FIELD_LIMITS.billing_address_line2} characters.`);
    }
    if (normalizedPayload.billing_city && normalizedPayload.billing_city.length > BILLING_FIELD_LIMITS.billing_city) {
      errors.push(`City exceeds maximum length of ${BILLING_FIELD_LIMITS.billing_city} characters.`);
    }
    if (normalizedPayload.billing_postal_code && normalizedPayload.billing_postal_code.length > BILLING_FIELD_LIMITS.billing_postal_code) {
      errors.push(`Postal Code exceeds maximum length of ${BILLING_FIELD_LIMITS.billing_postal_code} characters.`);
    }
    if (normalizedPayload.billing_state && (normalizedPayload.billing_state.length !== BILLING_FIELD_LIMITS.billing_state || normalizedPayload.billing_state !== normalizedPayload.billing_state.toUpperCase())) {
      errors.push(`State must be a 2-letter uppercase code.`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    let updatedClient;
    try {
      updatedClient = await updateClientBillingAddress(clientId, normalizedPayload);
    } catch (error) {
      if (!isMissingBillingColumnError(error)) {
        throw error;
      }

      await ensureBillingAddressColumns();
      updatedClient = await updateClientBillingAddress(clientId, normalizedPayload);
    }

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
              country: 'US',
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
    await persistApiError({
      route: "/api/clients/me",
      method: request.method,
      statusCode: 500,
      userId: String(session.user.id),
      userType: userType ?? null,
      error,
      metadata: { clientId },
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function updateAccountInfo(request: Request) {
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
    const payload = await request.json() as AccountInfoPayload;
    const client = await getClientById(clientId);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const normalizedEmail = normalizeTextField(payload.email);
    const normalizedCompany = normalizeTextField(payload.company_name);
    const normalizedPhone = normalizeTextField(payload.phone);

    if (!normalizedEmail || !normalizedCompany) {
      return NextResponse.json({ error: "Email and Company Name are required." }, { status: 400 });
    }

    // Validation
    if (normalizedEmail.length > ACCOUNT_INFO_FIELD_LIMITS.email) {
      return NextResponse.json({ error: "Email exceeds character limit." }, { status: 400 });
    }
    if (normalizedCompany.length > ACCOUNT_INFO_FIELD_LIMITS.company_name) {
      return NextResponse.json({ error: "Company Name exceeds character limit." }, { status: 400 });
    }
    if (normalizedPhone && normalizedPhone.length > ACCOUNT_INFO_FIELD_LIMITS.phone) {
      return NextResponse.json({ error: "Phone Number exceeds character limit." }, { status: 400 });
    }

    // New check: check if email is already in use by another account
    if (normalizedEmail !== client.email) {
      const emailTaken = await isEmailInUse(normalizedEmail, clientId);
      if (emailTaken) {
        return NextResponse.json({ error: "This email address is already in use." }, { status: 400 });
      }
    }

    // Account info changes or password verification
    const hasInfoChange = normalizedEmail !== client.email || normalizedCompany !== client.company_name || normalizedPhone !== client.phone;
    
    if (hasInfoChange || payload.currentPassword) {
      if (!payload.currentPassword) {
        return NextResponse.json({ error: "Password is required to update account information." }, { status: 400 });
      }

      const { valid } = await verifyPassword(payload.currentPassword, client.password_hash);
      if (!valid) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }

      // Send Security Alert to OLD email (only if email changed)
      if (normalizedEmail !== client.email && resend) {
        const secToken = encryptToken(JSON.stringify({
          userId: clientId,
          oldEmail: client.email,
          timestamp: Date.now()
        }));

        const protocol = process.env.NEXTAUTH_URL?.startsWith('https') ? 'https' : 'http';
        const host = process.env.NEXTAUTH_URL?.split('://')[1] || 'localhost:3000';
        const recoveryUrl = `${protocol}://${host}/change-email?sec_token=${encodeURIComponent(secToken)}`;

        try {
          await resend.emails.send({
            from: process.env.CONTACT_FROM_EMAIL || "security@clearsiteconsultants.com",
            to: client.email,
            subject: "Security Alert: Email Address Changed",
            text: `Security Alert: Your email address was recently changed. If you did not perform this action, please visit the following link to restore it immediately: ${recoveryUrl}. We also recommend that you change your password.`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #1e293b;">Security Alert</h2>
                <p>Your email address was recently changed. If you did not perform this action, please visit the link below to restore it immediately.</p>
                <div style="margin: 30px 0;">
                  <a href="${recoveryUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Change Email Address</a>
                </div>
                <p>We also recommend that you change your password to secure your account.</p>
                <p style="color: #64748b; font-size: 14px;">This is an automated security notification.</p>
              </div>
            `
          });
        } catch (emailError) {
          console.error("[api/clients/me] Failed to send security alert email", emailError);
          // We continue anyway, but maybe we should log this.
        }
      }
    }

    const updatedClient = await updateClientAccountInfo(clientId, {
      company_name: normalizedCompany,
      phone: normalizedPhone,
      email: normalizedEmail,
    });

    return NextResponse.json(updatedClient);
  } catch (error: unknown) {
    await persistApiError({
      route: "/api/clients/me",
      method: "PUT",
      statusCode: 500,
      userId: String(session.user.id),
      userType: userType ?? null,
      error,
      metadata: { clientId },
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const clonedRequest = request.clone();
  try {
    const payload = await clonedRequest.json();
    if ('company_name' in payload || 'email' in payload) {
      return updateAccountInfo(request);
    }
    return updateBillingAddress(request);
  } catch {
    return updateBillingAddress(request);
  }
}

export async function PATCH(request: Request) {
  const clonedRequest = request.clone();
  try {
    const payload = await clonedRequest.json();
    if ('company_name' in payload || 'email' in payload) {
      return updateAccountInfo(request);
    }
    return updateBillingAddress(request);
  } catch {
    return updateBillingAddress(request);
  }
}

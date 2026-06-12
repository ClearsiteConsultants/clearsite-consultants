import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";

// GET all client users (for admin)
// PUT update client details (plan, service_status, next_invoice_due)
export async function GET() {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session || userType !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await sql`
      SELECT
        c.id,
        c.email,
        c.company_name,
        c.plan,
        c.service_status,
        c.maintenance_fee_frequency,
        c.first_name,
        c.last_name,
        c.phone,
        c.next_invoice_due,
        EXISTS (
          SELECT 1
          FROM invoices i
          WHERE i.client_id = c.id
            AND (
              (
                i.paid_at IS NULL
                AND LOWER(COALESCE(i.qbo_sync_status, 'pending')) <> 'paid'
                AND COALESCE(BTRIM(i.qbo_payment_url), '') = ''
              )
              OR EXISTS (
                SELECT 1
                FROM error_logs e
                WHERE e.error_name = 'MissingQboPaymentUrl'
                  AND e.metadata->>'clientId' = i.client_id::text
                  AND e.metadata->>'invoiceId' = i.id::text
              )
            )
        ) AS action_needed
      FROM clients c
      ORDER BY company_name
    `;

    return NextResponse.json(result.rows, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Failed to fetch clients", error);
    await persistApiError({
      route: "/api/admin/clients",
      method: "GET",
      statusCode: 500,
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session || userType !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, plan, service_status, maintenance_fee_frequency } = body;
    const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan");
    const hasServiceStatus = Object.prototype.hasOwnProperty.call(body, "service_status");
    const hasMaintenanceFeeFrequency = Object.prototype.hasOwnProperty.call(body, "maintenance_fee_frequency");
    const normalizedPlan = typeof plan === "string" ? plan.trim() : plan;
    const normalizedServiceStatus = typeof service_status === "string" ? service_status.trim() : service_status;
    const normalizedFrequency = typeof maintenance_fee_frequency === "string" ? maintenance_fee_frequency.trim() : maintenance_fee_frequency;

    if (!id) {
      return NextResponse.json(
        { error: "Missing client ID" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE clients
      SET plan = CASE
            WHEN ${hasPlan} THEN ${normalizedPlan ?? null}
            ELSE plan
          END,
          service_status = CASE
            WHEN ${hasServiceStatus} THEN ${normalizedServiceStatus ?? null}
            ELSE service_status
          END,
          maintenance_fee_frequency = CASE
            WHEN ${hasMaintenanceFeeFrequency} THEN ${normalizedFrequency ?? 'Monthly'}
            WHEN ${hasServiceStatus} AND ${normalizedServiceStatus} = 'Active' AND maintenance_fee_frequency IS NULL THEN 'Monthly'
            ELSE maintenance_fee_frequency
          END,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, company_name, plan, service_status, maintenance_fee_frequency, first_name, last_name, phone, next_invoice_due
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const client = result.rows[0];
    const actionNeededResult = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM invoices i
        WHERE i.client_id = ${id}
          AND (
            (
              i.paid_at IS NULL
              AND LOWER(COALESCE(i.qbo_sync_status, 'pending')) <> 'paid'
              AND COALESCE(BTRIM(i.qbo_payment_url), '') = ''
            )
            OR EXISTS (
              SELECT 1
              FROM error_logs e
              WHERE e.error_name = 'MissingQboPaymentUrl'
                AND e.metadata->>'clientId' = i.client_id::text
                AND e.metadata->>'invoiceId' = i.id::text
            )
          )
      ) AS action_needed
    `;

    return NextResponse.json(
      {
        message: "Client updated successfully",
        client: {
          ...client,
          action_needed: Boolean(actionNeededResult.rows[0]?.action_needed),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update client", error);
    await persistApiError({
      route: "/api/admin/clients",
      method: "PUT",
      statusCode: 500,
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

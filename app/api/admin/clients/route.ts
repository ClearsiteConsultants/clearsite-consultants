import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";
import { 
  generateMaintenanceInvoicesForClient, 
  updateUnpaidMaintenanceInvoices 
} from "@/lib/maintenance-invoicing";
import { isQuickBooksReconnectRequiredError } from "@/lib/quickbooks";

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
        c.client_status,
        c.maintenance_fee_frequency,
        c.service_start_date,
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
    const { id, plan, service_status, client_status, maintenance_fee_frequency, service_start_date } = body;
    const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan");
    const hasServiceStatus = Object.prototype.hasOwnProperty.call(body, "service_status");
    const hasClientStatus = Object.prototype.hasOwnProperty.call(body, "client_status");
    const hasMaintenanceFeeFrequency = Object.prototype.hasOwnProperty.call(body, "maintenance_fee_frequency");
    const hasServiceStartDate = Object.prototype.hasOwnProperty.call(body, "service_start_date");
    const normalizedPlan = typeof plan === "string" ? plan.trim() : plan;
    const normalizedServiceStatus = typeof service_status === "string" ? service_status.trim() : service_status;
    const normalizedClientStatus = typeof client_status === "string" ? client_status.trim() : client_status;
    const normalizedFrequency = typeof maintenance_fee_frequency === "string" ? maintenance_fee_frequency.trim() : maintenance_fee_frequency;
    const normalizedServiceStartDate = typeof service_start_date === "string" ? service_start_date.trim() : service_start_date;
    const finalServiceStartDate = normalizedServiceStartDate === "" ? null : normalizedServiceStartDate;

    if (!id) {
      return NextResponse.json(
        { error: "Missing client ID" },
        { status: 400 }
      );
    }

    // Fetch current state for validation and trigger logic
    const currentClientResult = await sql`SELECT * FROM clients WHERE id = ${id}`;
    if (currentClientResult.rows.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const currentClient = currentClientResult.rows[0];

    // Enforce validation: service_status = "Active" only if client_status, plan and frequency are valid.
    const finalClientStatus = hasClientStatus ? normalizedClientStatus : currentClient.client_status;
    const finalPlan = hasPlan ? normalizedPlan : currentClient.plan;
    const finalFrequency = hasMaintenanceFeeFrequency ? normalizedFrequency : currentClient.maintenance_fee_frequency;
    const finalServiceStatus = hasServiceStatus ? normalizedServiceStatus : currentClient.service_status;

    if (hasServiceStatus && normalizedServiceStatus === "Active" && currentClient.service_status !== "Active") {
      if (finalClientStatus !== "Active") {
        return NextResponse.json({ error: "Cannot set service to Active when client status is Inactive" }, { status: 400 });
      }
      if (!finalPlan) {
        return NextResponse.json({ error: "Cannot set service to Active without a core plan" }, { status: 400 });
      }
      if (!finalFrequency) {
        return NextResponse.json({ error: "Cannot set service to Active without a maintenance fee frequency" }, { status: 400 });
      }
    }

    const becomingActive = (currentClient.service_status !== "Active" && finalServiceStatus === "Active");
    const planChanged = (hasPlan && normalizedPlan !== currentClient.plan) || (hasMaintenanceFeeFrequency && normalizedFrequency !== currentClient.maintenance_fee_frequency);

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
          client_status = CASE
            WHEN ${hasClientStatus} THEN ${normalizedClientStatus ?? 'Active'}
            ELSE client_status
          END,
          maintenance_fee_frequency = CASE
            WHEN ${hasMaintenanceFeeFrequency} THEN ${normalizedFrequency ?? 'Monthly'}
            ELSE maintenance_fee_frequency
          END,
          service_start_date = CASE
            WHEN ${hasServiceStartDate} THEN ${finalServiceStartDate}
            WHEN ${becomingActive} THEN NOW()::DATE
            ELSE service_start_date
          END,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    const client = result.rows[0];

    // Trigger maintenance invoicing logic
    if (becomingActive) {
      try {
        await generateMaintenanceInvoicesForClient(String(id));
      } catch (error) {
        console.error("Failed to trigger initial maintenance fee:", error);
        if (isQuickBooksReconnectRequiredError(error)) {
          throw error;
        }
      }
    } else if (planChanged && finalServiceStatus === "Active") {
      try {
        await updateUnpaidMaintenanceInvoices(String(id), finalPlan, finalFrequency);
      } catch (error) {
        console.error("Failed to update unpaid maintenance fees:", error);
        if (isQuickBooksReconnectRequiredError(error)) {
          throw error;
        }
      }
    }

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
      statusCode: isQuickBooksReconnectRequiredError(error) ? 503 : 500,
      error,
    });
    
    if (isQuickBooksReconnectRequiredError(error)) {
      return NextResponse.json(
        { error: "QuickBooks reconnect required", reconnectRequired: true },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

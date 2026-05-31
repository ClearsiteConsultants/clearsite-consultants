import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session || userType !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId } = await context.params;

    const clientResult = await sql`
      SELECT id
      FROM clients
      WHERE id = ${clientId}
      LIMIT 1
    `;

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const issuesResult = await sql`
      SELECT
        i.id AS invoice_id,
        i.qbo_doc_number,
        i.qbo_invoice_id,
        i.qbo_sync_status,
        i.due_date,
        i.invoice_date,
        i.invoice_total AS amount_total,
        i.amount_paid,
        i.last_synced_at,
        i.created_at,
        log.error_message AS logged_error_message,
        log.created_at AS logged_at
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT
          e.error_message,
          e.created_at
        FROM error_logs e
        WHERE e.error_name = 'MissingQboPaymentUrl'
          AND e.metadata->>'clientId' = ${clientId}
          AND e.metadata->>'invoiceId' = i.id::text
        ORDER BY e.created_at DESC
        LIMIT 1
      ) log ON TRUE
      WHERE i.client_id = ${clientId}
        AND (
          (
            i.paid_at IS NULL
            AND LOWER(COALESCE(i.qbo_sync_status, 'pending')) <> 'paid'
            AND COALESCE(BTRIM(i.qbo_payment_url), '') = ''
          )
          OR log.error_message IS NOT NULL
        )
      ORDER BY COALESCE(log.created_at, i.last_synced_at, i.created_at) DESC
    `;

    const issues = issuesResult.rows.map((row) => ({
      invoiceId: row.invoice_id,
      qboDocNumber: row.qbo_doc_number,
      qboInvoiceId: row.qbo_invoice_id,
      qboSyncStatus: row.qbo_sync_status,
      dueDate: row.due_date,
      invoiceDate: row.invoice_date,
      amountTotal: row.amount_total,
      amountPaid: row.amount_paid,
      updatedAt: row.logged_at || row.last_synced_at || row.created_at || null,
      errorMessage:
        (typeof row.logged_error_message === "string" && row.logged_error_message.trim()) ||
        `Missing qbo_payment_url for client ${clientId}, invoice ${row.qbo_doc_number || row.invoice_id}.`,
    }));

    return NextResponse.json(
      {
        clientId,
        actionNeeded: issues.length > 0,
        issues,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch action-needed issues", error);
    await persistApiError({
      route: "/api/admin/clients/[clientId]/action-needed",
      method: "GET",
      statusCode: 500,
      error,
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
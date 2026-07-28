import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";
import {
  buildBillingSummary,
  getBillingStatus,
  type BillingInvoice,
} from "@/lib/billing-history";

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
      SELECT
        id,
        company_name,
        email,
        first_name,
        last_name,
        plan,
        service_status,
        maintenance_fee_frequency,
        next_invoice_due
      FROM clients
      WHERE id = ${clientId}
      LIMIT 1
    `;

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const invoicesResult = await sql`
      SELECT
        id,
        qbo_invoice_id,
        qbo_doc_number,
        invoice_total,
        amount_paid,
        invoice_date,
        due_date,
        qbo_sync_status,
        paid_at,
        last_synced_at,
        created_at
      FROM invoices
      WHERE client_id = ${clientId}
      ORDER BY COALESCE(invoice_date, created_at) DESC, created_at DESC
    `;

    const invoices = invoicesResult.rows.map((row) => {
      const billingInvoice: BillingInvoice = {
        invoiceTotal: Number(row.invoice_total || 0),
        amountPaid: Number(row.amount_paid || 0),
        dueDate: row.due_date || null,
        qboSyncStatus: row.qbo_sync_status || null,
        paidAt: row.paid_at || null,
      };

      return {
        id: row.id,
        qboInvoiceId: row.qbo_invoice_id || null,
        qboDocNumber: row.qbo_doc_number || null,
        invoiceTotal: billingInvoice.invoiceTotal,
        amountPaid: billingInvoice.amountPaid,
        invoiceDate: row.invoice_date || null,
        dueDate: billingInvoice.dueDate,
        qboSyncStatus: billingInvoice.qboSyncStatus,
        paidAt: billingInvoice.paidAt,
        lastSyncedAt: row.last_synced_at || null,
        createdAt: row.created_at,
        status: getBillingStatus(billingInvoice),
      };
    });

    const summary = buildBillingSummary(
      invoices.map((invoice) => ({
        invoiceTotal: invoice.invoiceTotal,
        amountPaid: invoice.amountPaid,
        dueDate: invoice.dueDate,
        qboSyncStatus: invoice.qboSyncStatus,
        paidAt: invoice.paidAt,
      }))
    );

    return NextResponse.json(
      {
        client: clientResult.rows[0],
        summary,
        invoices,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch client billing history", error);
    await persistApiError({
      route: "/api/admin/clients/[clientId]/billing",
      method: "GET",
      statusCode: 500,
      error,
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

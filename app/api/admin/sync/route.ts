import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAllClients, getQuickBooksConnection, sql } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";
import { getQuickBooksCustomers, getQuickBooksItems, isQuickBooksReconnectRequiredError } from "@/lib/quickbooks";
import { syncClientInvoicesFromQuickBooks } from "@/lib/quickbooks-sync";

type SyncErrorSummary = {
  scope: "invoices" | "items" | "customers" | "developer-logs";
  message: string;
};

export async function POST() {
  const startedAt = new Date();

  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

    if (!session?.user?.id || userType !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await getQuickBooksConnection();
    if (!connection) {
      return NextResponse.json(
        {
          error: "QuickBooks authorization is no longer valid. Reconnect QuickBooks to continue.",
          reconnectRequired: true,
          reconnectReason: "missing_connection",
        },
        { status: 503 }
      );
    }

    const errors: SyncErrorSummary[] = [];

    const clients = await getAllClients();
    let syncedInvoices = 0;
    let failedInvoices = 0;
    let failedClients = 0;

    for (const client of clients) {
      try {
        const result = await syncClientInvoicesFromQuickBooks(String(client.id), {
          origin: "admin-sync",
          route: "/api/admin/sync",
          method: "POST",
        });
        syncedInvoices += Number(result?.synced ?? 0);
        failedInvoices += Number(result?.failed ?? 0);
      } catch (error) {
        failedClients += 1;
        errors.push({
          scope: "invoices",
          message: error instanceof Error ? error.message : `Failed invoice refresh for client ${String(client.id)}`,
        });
      }
    }

    let productsServicesCount: number | null = null;
    let customersCount: number | null = null;

    try {
      const items = await getQuickBooksItems(connection.realm_id);
      productsServicesCount = Array.isArray(items) ? items.length : 0;
    } catch (error) {
      errors.push({
        scope: "items",
        message: error instanceof Error ? error.message : "Failed to refresh QuickBooks products/services",
      });
    }

    try {
      const customers = await getQuickBooksCustomers(connection.realm_id);
      customersCount = Array.isArray(customers) ? customers.length : 0;
    } catch (error) {
      errors.push({
        scope: "customers",
        message: error instanceof Error ? error.message : "Failed to refresh QuickBooks customers",
      });
    }

    let newMissingPaymentUrlLogs = 0;
    try {
      const logsResult = await sql`
        SELECT COUNT(*)::INT AS count
        FROM error_logs
        WHERE error_name = 'MissingQboPaymentUrl'
          AND metadata->>'origin' = 'admin-sync'
          AND created_at >= ${startedAt.toISOString()}::timestamp
      `;
      newMissingPaymentUrlLogs = Number(logsResult.rows[0]?.count ?? 0);
    } catch (error) {
      errors.push({
        scope: "developer-logs",
        message: error instanceof Error ? error.message : "Failed to summarize developer logs",
      });
    }

    return NextResponse.json({
      ok: errors.length === 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      invoiceSync: {
        clientsProcessed: clients.length,
        clientsFailed: failedClients,
        syncedInvoices,
        failedInvoices,
      },
      qboData: {
        productsServicesCount,
        customersCount,
      },
      developerLogs: {
        newMissingPaymentUrlLogs,
        created: newMissingPaymentUrlLogs > 0,
      },
      errors,
    });
  } catch (error: unknown) {
    await persistApiError({
      route: "/api/admin/sync",
      method: "POST",
      statusCode: isQuickBooksReconnectRequiredError(error) ? 503 : 500,
      error,
    });

    if (isQuickBooksReconnectRequiredError(error)) {
      return NextResponse.json(
        {
          error: "QuickBooks authorization is no longer valid. Reconnect QuickBooks to continue.",
          reconnectRequired: true,
          reconnectReason: error.reconnectReason,
        },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

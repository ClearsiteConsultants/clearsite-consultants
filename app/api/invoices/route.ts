import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  createInvoice,
  getAllClients,
  getClientBillingAddress,
  getClientInvoicesForPortal,
} from "@/lib/db";
import { getQuickBooksConnection } from "@/lib/db";
import { getQuickBooksItems, getQuickBooksCustomers, isQuickBooksReconnectRequiredError } from "@/lib/quickbooks";
import { syncClientInvoicesFromQuickBooks, syncInvoiceToQuickBooks, linkInvoiceByDocNumber } from "@/lib/quickbooks-sync";
import { persistApiError } from "@/lib/error-logger";

function parseClientId(sessionUserId: string) {
  const normalized = sessionUserId.trim();
  for (const prefix of ["client:", "client_", "client-"]) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

function quickBooksReconnectResponse(error: unknown) {
  if (!isQuickBooksReconnectRequiredError(error)) return null;
  return {
    reconnectRequired: true,
    reconnectReason: error.reconnectReason,
    message: "QuickBooks authorization is no longer valid. Reconnect QuickBooks to continue.",
  };
}

// Helper: get today + 30 days in YYYY-MM-DD format (server timezone)
function getServerDatePlus30Days(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: validate due date is at least 30 days from today
function isValidServerDueDate(dueDateString: string): boolean {
  if (!dueDateString) return false;
  const minDate = getServerDatePlus30Days();
  return dueDateString >= minDate;
}

// GET /api/invoices - Get client's invoices or admin lists
export async function GET(req: NextRequest) {
  let sessionUserId: string | null = null;
  let sessionUserType: string | null = null;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userType = (session.user as { user_type?: string }).user_type;
    sessionUserId = String(session.user.id);
    sessionUserType = userType ?? null;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (userType === "client") {
      const clientId = parseClientId(session.user.id as string);
      try {
        await syncClientInvoicesFromQuickBooks(clientId, {
          origin: "portal-read",
          route: "/api/invoices",
          method: "GET",
        });
      } catch {
        // Fall back to local invoice data when QuickBooks sync is unavailable.
      }
      const invoices = await getClientInvoicesForPortal(clientId);

      return NextResponse.json(invoices, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    if (action === "admin-list") {
      if (userType !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Admin endpoint to list all clients
      const clients = await getAllClients();
      return NextResponse.json(clients, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    if (action === "qbo-customers") {
      if (userType !== "admin") {
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
      try {
        const customers = await getQuickBooksCustomers(connection.realm_id);
        return NextResponse.json(customers, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      } catch (error) {
        const reconnect = quickBooksReconnectResponse(error);
        if (reconnect) {
          return NextResponse.json(
            {
              error: reconnect.message,
              reconnectRequired: true,
              reconnectReason: reconnect.reconnectReason,
            },
            { status: 503 }
          );
        }
        throw error;
      }
    }

    if (action === "qbo-items") {
      if (userType !== "admin") {
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
      try {
        const items = await getQuickBooksItems(connection.realm_id);
        return NextResponse.json(items, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      } catch (error) {
        const reconnect = quickBooksReconnectResponse(error);
        if (reconnect) {
          return NextResponse.json(
            {
              error: reconnect.message,
              reconnectRequired: true,
              reconnectReason: reconnect.reconnectReason,
            },
            { status: 503 }
          );
        }
        throw error;
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
      await persistApiError({
        route: "/api/invoices",
        method: "GET",
        statusCode: 500,
        userId: sessionUserId,
        userType: sessionUserType,
        error,
      });
      const reconnect = quickBooksReconnectResponse(error);
      if (reconnect) {
        return NextResponse.json(
          {
            error: reconnect.message,
            reconnectRequired: true,
            reconnectReason: reconnect.reconnectReason,
          },
          { status: 503 }
        );
      }
      const message = error instanceof Error ? error.message : "Internal server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/invoices - Create invoice (admin only)
export async function POST(req: NextRequest) {
  let sessionUserId: string | null = null;
  let sessionUserType: string | null = null;
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
    if (!session?.user?.id || userType !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    sessionUserId = String(session.user.id);
    sessionUserType = userType ?? null;

    const body = await req.json();
    const {
      client_id,
      invoice_total,
      invoice_date,
      due_date,
      qbo_item_id,
      sync_to_qbo,
      // Manual-link mode fields
      mode,
      manual_link_mode,
      qbo_doc_number,
      qbo_customer_id,
    } = body;

    if (!client_id) {
      return NextResponse.json({ error: "Client is required." }, { status: 400 });
    }

    const selectedClient = await getClientBillingAddress(String(client_id));
    if (!selectedClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const requiredBillingFields: Array<{
      key: "billing_address_line1" | "billing_city" | "billing_state" | "billing_postal_code";
      label: string;
    }> = [
      { key: "billing_address_line1", label: "line1" },
      { key: "billing_city", label: "city" },
      { key: "billing_state", label: "state" },
      { key: "billing_postal_code", label: "postal code" },
      // { key: "billing_country", label: "country" },
    ];

    const missingBillingFields = requiredBillingFields
      .filter(({ key }) => !String(selectedClient[key] ?? "").trim())
      .map(({ label }) => label);

    if (missingBillingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Billing address is incomplete. Missing required fields: ${missingBillingFields.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // ── Manual-link mode ──────────────────────────────────────────────
    if (mode === "manual-link") {
      if (!qbo_doc_number || !String(qbo_doc_number).trim()) {
        return NextResponse.json({ error: "QuickBooks Invoice Number is required." }, { status: 400 });
      }

      const invoiceNumber = String(qbo_doc_number).trim();
      const linkMode = manual_link_mode === "new-client" ? "new-client" : "existing-client";

      if (linkMode === "new-client" && !qbo_customer_id) {
        return NextResponse.json({ error: "QuickBooks customer is required." }, { status: 400 });
      }

      try {
        const invoice = await linkInvoiceByDocNumber({
          clientId: String(client_id),
          qboCustomerId: linkMode === "new-client" ? String(qbo_customer_id) : undefined,
          qboDocNumber: invoiceNumber,
        }, {
          origin: "admin-link",
          route: "/api/invoices",
          method: "POST",
        });
        return NextResponse.json(invoice, { status: 201 });
      } catch (linkError: unknown) {
        const err = linkError instanceof Error ? linkError : new Error("Could not link invoice.");
        const code = (err as { code?: string }).code;
        if (code === "NOT_FOUND") {
          return NextResponse.json({ error: err.message }, { status: 404 });
        }
        if (code === "DUPLICATE") {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
        await persistApiError({
          route: "/api/invoices",
          method: "POST",
          statusCode: 500,
          userId: sessionUserId,
          userType: sessionUserType,
          error: err,
          metadata: {
            mode: "manual-link",
            clientId: String(client_id),
            qboDocNumber: String(qbo_doc_number || ""),
          },
        });
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // ── QuickBooks-first mode (default) ───────────────────────────────
    if (!client_id || !invoice_total || !due_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (Number(invoice_total) <= 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate due date is at least 30 days from today
    if (!isValidServerDueDate(String(due_date))) {
      const minDate = getServerDatePlus30Days();
      return NextResponse.json(
        { error: `Due date must be at least 30 days from today. Minimum: ${minDate}.` },
        { status: 400 }
      );
    }

    const invoice = await createInvoice({
      client_id,
      invoice_total: Number(invoice_total),
      invoice_date: invoice_date || null,
      due_date,
      qbo_sync_status: "pending",
      // Store the selected item ID as a temporary field for sync to pick up
      // (qbo_item_id is not a DB column — it's carried through the in-memory invoice object)
    });

    if (sync_to_qbo !== false) {
      try {
        // Attach the selected item id to the in-memory invoice for syncInvoiceToQuickBooks.
        const invoiceWithItem = { ...invoice, qbo_item_id: qbo_item_id || null };
        const syncedInvoice = await syncInvoiceToQuickBooks(String(invoice.id), invoiceWithItem, {
          origin: "admin-create",
          route: "/api/invoices",
          method: "POST",
        });
        return NextResponse.json(syncedInvoice, { status: 201 });
      } catch (syncError: unknown) {
        await persistApiError({
          route: "/api/invoices",
          method: "POST",
          statusCode: 502,
          userId: sessionUserId,
          userType: sessionUserType,
          error: syncError,
          metadata: {
            mode: "quickbooks-sync",
            clientId: String(client_id),
            invoiceId: String(invoice.id),
          },
        });
        const reconnect = quickBooksReconnectResponse(syncError);
        if (reconnect) {
          return NextResponse.json(
            {
              ...invoice,
              qbo_sync_status: "sync_error",
              sync_error: reconnect.message,
              reconnectRequired: true,
              reconnectReason: reconnect.reconnectReason,
            },
            { status: 201 }
          );
        }
        const syncMessage = syncError instanceof Error ? syncError.message : "QuickBooks sync failed";
        return NextResponse.json(
          {
            ...invoice,
            qbo_sync_status: "sync_error",
            sync_error: syncMessage,
            reconnectRequired: false,
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: unknown) {
    await persistApiError({
      route: "/api/invoices",
      method: "POST",
      statusCode: 500,
      userId: sessionUserId,
      userType: sessionUserType,
      error,
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

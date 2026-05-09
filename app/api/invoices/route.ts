import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  updateClientPlan,
  cancelClientService,
  createInvoice,
  getAllClients,
  getClientInvoicesForPortal,
} from "@/lib/db";
import { getQuickBooksConnection } from "@/lib/db";
import { getQuickBooksItems, getQuickBooksCustomers } from "@/lib/quickbooks";
import { syncClientInvoicesFromQuickBooks, syncInvoiceToQuickBooks, linkInvoiceById } from "@/lib/quickbooks-sync";

function parseClientId(sessionUserId: string) {
  if (sessionUserId.startsWith("client:")) {
    return sessionUserId.slice("client:".length);
  }
  return sessionUserId;
}

// GET /api/invoices - Get client's invoices or admin lists
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userType = (session.user as { user_type?: string }).user_type;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (userType === "client") {
      const clientId = parseClientId(session.user.id as string);
      try {
        await syncClientInvoicesFromQuickBooks(clientId);
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
      return NextResponse.json(clients);
    }

    if (action === "qbo-customers") {
      if (userType !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const connection = await getQuickBooksConnection();
      if (!connection) {
        return NextResponse.json({ error: "QuickBooks is not connected" }, { status: 503 });
      }
      const customers = await getQuickBooksCustomers(connection.realm_id);
      return NextResponse.json(customers);
    }

    if (action === "qbo-items") {
      if (userType !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const connection = await getQuickBooksConnection();
      if (!connection) {
        return NextResponse.json({ error: "QuickBooks is not connected" }, { status: 503 });
      }
      const items = await getQuickBooksItems(connection.realm_id);
      return NextResponse.json(items);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/invoices - Create invoice (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
    if (!session?.user?.id || userType !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      client_id,
      amount_due,
      invoice_date,
      due_date,
      qbo_item_id,
      sync_to_qbo,
      // Manual-link mode fields
      mode,
      manual_link_mode,
      qbo_invoice_id,
      qbo_customer_id,
    } = body;

    // ── Manual-link mode ──────────────────────────────────────────────
    if (mode === "manual-link") {
      if (!qbo_invoice_id || !String(qbo_invoice_id).trim()) {
        return NextResponse.json({ error: "QuickBooks Invoice ID is required." }, { status: 400 });
      }

      const invoiceId = String(qbo_invoice_id).trim();
      const linkMode = manual_link_mode === "new-client" ? "new-client" : "existing-client";

      if (linkMode === "existing-client") {
        if (!client_id) {
          return NextResponse.json({ error: "Client is required." }, { status: 400 });
        }
      } else if (!qbo_customer_id) {
        return NextResponse.json({ error: "QuickBooks customer is required." }, { status: 400 });
      }

      try {
        const invoice = await linkInvoiceById({
          clientId: linkMode === "existing-client" ? String(client_id) : undefined,
          qboCustomerId: linkMode === "new-client" ? String(qbo_customer_id) : undefined,
          qboInvoiceId: invoiceId,
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
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // ── QuickBooks-first mode (default) ───────────────────────────────
    if (!client_id || !amount_due || !due_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const invoice = await createInvoice({
      client_id,
      invoice_number: null,
      amount_due: Number(amount_due),
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
        const syncedInvoice = await syncInvoiceToQuickBooks(String(invoice.id), invoiceWithItem);
        return NextResponse.json(syncedInvoice, { status: 201 });
      } catch (syncError: unknown) {
        const syncMessage = syncError instanceof Error ? syncError.message : "QuickBooks sync failed";
        return NextResponse.json(
          {
            ...invoice,
            qbo_sync_status: "sync_error",
            sync_error: syncMessage,
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/invoices - Update plan or cancel service
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, client_id, new_plan } = await req.json();

    if (action === "update-plan") {
      const client = await updateClientPlan(client_id, new_plan);
      return NextResponse.json(client);
    }

    if (action === "cancel-service") {
      const client = await cancelClientService(client_id);
      return NextResponse.json(client);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

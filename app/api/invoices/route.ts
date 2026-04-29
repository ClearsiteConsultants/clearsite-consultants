import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  updateClientPlan,
  cancelClientService,
  createInvoice,
  getAllClients,
  getClientInvoicesForPortal,
  checkDuplicateManualLink,
} from "@/lib/db";
import { syncInvoiceToQuickBooks } from "@/lib/quickbooks-sync";
import { isValidQboPaymentUrl } from "@/lib/utils";

function parseClientId(sessionUserId: string) {
  if (sessionUserId.startsWith("client:")) {
    return sessionUserId.slice("client:".length);
  }
  return sessionUserId;
}

// GET /api/invoices - Get client's invoices
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
      due_date,
      sync_to_qbo,
      // Manual-link mode fields
      mode,
      qbo_payment_url,
      invoice_number,
      qbo_invoice_id,
      notes,
    } = body;

    // ── Manual-link mode ──────────────────────────────────────────────
    if (mode === "manual-link") {
      if (!client_id) {
        return NextResponse.json({ error: "Client is required." }, { status: 400 });
      }
      if (!qbo_payment_url) {
        return NextResponse.json({ error: "QuickBooks Payment Link is required." }, { status: 400 });
      }
      if (!isValidQboPaymentUrl(String(qbo_payment_url))) {
        return NextResponse.json({ error: "Enter a valid https:// QuickBooks payment link." }, { status: 400 });
      }
      if (!amount_due || Number(amount_due) <= 0) {
        return NextResponse.json({ error: "Amount Due must be greater than 0." }, { status: 400 });
      }
      if (!due_date) {
        return NextResponse.json({ error: "Due Date is required." }, { status: 400 });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(due_date) < today) {
        return NextResponse.json({ error: "Due Date must be today or later." }, { status: 400 });
      }

      const isDuplicate = await checkDuplicateManualLink(client_id, qbo_payment_url);
      if (isDuplicate) {
        return NextResponse.json(
          { error: "This client already has an invoice with this QuickBooks payment link." },
          { status: 409 }
        );
      }

      try {
        const invoice = await createInvoice({
          client_id,
          invoice_number: invoice_number || null,
          amount_due: Number(amount_due),
          due_date,
          qbo_payment_url,
          qbo_invoice_id: qbo_invoice_id || null,
          qbo_sync_status: "sent",
          is_manual_link: true,
          notes: notes || null,
        });
        return NextResponse.json(invoice, { status: 201 });
      } catch {
        return NextResponse.json({ error: "Could not save linked invoice. Please try again." }, { status: 500 });
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
      due_date,
      qbo_sync_status: "pending",
    });

    if (sync_to_qbo !== false) {
      try {
        const syncedInvoice = await syncInvoiceToQuickBooks(String(invoice.id));
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

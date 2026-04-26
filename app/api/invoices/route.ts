import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  updateClientPlan,
  cancelClientService,
  createInvoice,
  getAllClients,
  getClientInvoicesForPortal,
} from "@/lib/db";
import { syncInvoiceToQuickBooks } from "@/lib/quickbooks-sync";

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

    const {
      client_id,
      invoice_number,
      amount_due,
      due_date,
      file_url,
      qbo_payment_url,
      sync_to_qbo,
    } =
      await req.json();

    if (!client_id || !invoice_number || !amount_due || !due_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const invoice = await createInvoice({
      client_id,
      invoice_number,
      amount_due,
      due_date,
      file_url,
      qbo_payment_url,
      qbo_sync_status: qbo_payment_url ? "sent" : "pending",
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

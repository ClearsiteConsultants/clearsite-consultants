import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  updateClientPlan,
  cancelClientService,
  createInvoice,
  getAllClients,
} from "@/lib/db";

// GET /api/invoices - Get client's invoices
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "admin-list") {
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client_id, invoice_number, amount_due, due_date, file_url, qbo_payment_url } =
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
    });

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

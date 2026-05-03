import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";

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
      SELECT id, email, company_name, plan, service_status, first_name, last_name, phone, next_invoice_due
      FROM clients
      ORDER BY company_name
    `;

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch clients", error);
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

    const { id, plan, service_status } = await req.json();
    const normalizedPlan = plan ?? null;
    const normalizedServiceStatus = service_status ?? null;

    if (!id) {
      return NextResponse.json(
        { error: "Missing client ID" },
        { status: 400 }
      );
    }

    // Update client
    const result = await sql`
      UPDATE clients
      SET plan = COALESCE(${normalizedPlan}, plan),
          service_status = COALESCE(${normalizedServiceStatus}, service_status),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, company_name, plan, service_status, first_name, last_name, phone, next_invoice_due
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(

      { message: "Client updated successfully", client: result.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update client", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

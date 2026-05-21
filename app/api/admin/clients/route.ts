import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";

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
    const { id, plan, service_status } = body;
    const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan");
    const hasServiceStatus = Object.prototype.hasOwnProperty.call(body, "service_status");
    const normalizedPlan = typeof plan === "string" ? plan.trim() : plan;
    const normalizedServiceStatus = typeof service_status === "string" ? service_status.trim() : service_status;

    if (!id) {
      return NextResponse.json(
        { error: "Missing client ID" },
        { status: 400 }
      );
    }

    // Update client
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
    await persistApiError({
      route: "/api/admin/clients",
      method: "PUT",
      statusCode: 500,
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getInvoicePdfById, getQuickBooksConnection } from "@/lib/db";
import { getQuickBooksInvoicePdf, isQuickBooksReconnectRequiredError } from "@/lib/quickbooks";

function parseClientId(sessionUserId: string) {
  const normalized = sessionUserId.trim();
  for (const prefix of ["client:", "client_", "client-"]) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

function sanitizeFilenameSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const row = await getInvoicePdfById(id);

    if (!row) {
      return NextResponse.json({ error: "Invoice PDF not available" }, { status: 404 });
    }

    // Access control: admins are blocked; clients can only access their own invoices.
    const userType = (session.user as { user_type?: string }).user_type;
    if (userType === "admin") {
      return NextResponse.json(
        { error: "Admins cannot download client PDFs; view in QuickBooks Online instead" },
        { status: 403 }
      );
    }

    if (userType === "client") {
      const clientId = parseClientId(session.user.id as string);
      if (String(row.client_id) !== clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!row.qbo_invoice_id) {
      return NextResponse.json({ error: "Invoice PDF not available" }, { status: 404 });
    }

    const connection = await getQuickBooksConnection();
    if (!connection?.realm_id) {
      return NextResponse.json(
        { error: "QuickBooks service unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const pdfPayload = await getQuickBooksInvoicePdf(String(connection.realm_id), String(row.qbo_invoice_id));
    const nodeBuffer = Buffer.isBuffer(pdfPayload.data) ? pdfPayload.data : Buffer.from(pdfPayload.data);
    const arrayBuffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength
    ) as ArrayBuffer;

    const docNumber = typeof row.qbo_doc_number === "string" ? row.qbo_doc_number : null;
    const sanitizedDocNumber = docNumber ? sanitizeFilenameSegment(docNumber) : null;
    const filename = sanitizedDocNumber ? `${sanitizedDocNumber}.pdf` : `invoice-${sanitizeFilenameSegment(id)}.pdf`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": pdfPayload.mimeType || "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(nodeBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    if (isQuickBooksReconnectRequiredError(error)) {
      return NextResponse.json(
        { error: "QuickBooks service unavailable. Please reconnect and try again." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("QuickBooks API request failed") || message.includes("QuickBooks")) {
      return NextResponse.json(
        { error: "QuickBooks service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

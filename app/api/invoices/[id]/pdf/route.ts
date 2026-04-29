import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getInvoicePdfById } from "@/lib/db";

function parseClientId(sessionUserId: string) {
  if (sessionUserId.startsWith("client:")) {
    return sessionUserId.slice("client:".length);
  }
  return sessionUserId;
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
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    // Access control: clients can only access their own invoices; admins can access any.
    const userType = (session.user as { user_type?: string }).user_type;
    if (userType === "client") {
      const clientId = parseClientId(session.user.id as string);
      if (String(row.client_id) !== clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (userType !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pdfData = row.pdf_data as Buffer | Uint8Array | null;
    if (!pdfData) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    // Normalize to a proper ArrayBuffer to satisfy TypeScript's Blob/BodyInit constraints.
    const nodeBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
    const arrayBuffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength
    ) as ArrayBuffer;

    const mimeType = (row.pdf_mime_type as string | null) || "application/pdf";
    const filename = (row.pdf_filename as string | null) || `invoice-${id}.pdf`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(nodeBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

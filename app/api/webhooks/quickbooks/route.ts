import { NextRequest, NextResponse } from "next/server";
import { syncInvoiceByQuickBooksInvoiceId } from "@/lib/quickbooks-sync";
import { verifyQuickBooksWebhookSignature } from "@/lib/quickbooks";

type QuickBooksWebhookPayload = {
  eventNotifications?: Array<{
    dataChangeEvent?: {
      entities?: Array<{
        name?: string;
        id?: string;
      }>;
    };
  }>;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("intuit-signature");

  if (!verifyQuickBooksWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as QuickBooksWebhookPayload;
    const notifications = payload.eventNotifications || [];

    for (const notification of notifications) {
      const entities = notification.dataChangeEvent?.entities || [];
      for (const entity of entities) {
        if (entity.name === "Invoice" && entity.id) {
          await syncInvoiceByQuickBooksInvoiceId(entity.id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import {
  getClientQuickBooksProfile,
  getInvoiceById,
  getQuickBooksConnection,
  setClientQuickBooksCustomerId,
  updateInvoiceQuickBooksData,
  updateInvoiceStatusByQuickBooksInvoiceId,
} from "@/lib/db";
import {
  createQuickBooksCustomer,
  createQuickBooksInvoice,
  extractQuickBooksInvoiceState,
  findQuickBooksCustomerByDisplayName,
  getQuickBooksInvoice,
  getQuickBooksInvoicePdf,
} from "@/lib/quickbooks";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toWebsiteUri(value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

async function ensureQuickBooksCustomer(clientId: string) {
  const client = await getClientQuickBooksProfile(clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  if (client.qbo_customer_id) {
    return String(client.qbo_customer_id);
  }

  if (!client.company_name) {
    throw new Error("Client is missing a company name required for QuickBooks sync");
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
  }

  const existing = await findQuickBooksCustomerByDisplayName(connection.realm_id, client.company_name);
  const customerId = existing?.Id
    ? String(existing.Id)
    : String(
        (
          await createQuickBooksCustomer(connection.realm_id, {
            displayName: client.company_name,
            email: client.email || undefined,
            phone: client.phone || undefined,
            website: toWebsiteUri(client.domain_name),
          })
        ).Id
      );

  await setClientQuickBooksCustomerId(String(client.id), customerId);
  return customerId;
}

export async function syncInvoiceToQuickBooks(localInvoiceId: string) {
  const invoice = await getInvoiceById(localInvoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
  }

  if (!invoice.qbo_invoice_id) {
    const customerId = await ensureQuickBooksCustomer(String(invoice.client_id));
    // invoice_number may be null — let QuickBooks auto-generate the DocNumber
    const qboInvoice = await createQuickBooksInvoice(connection.realm_id, {
      customerId,
      invoiceNumber: invoice.invoice_number ? String(invoice.invoice_number) : undefined,
      amountDue: toNumber(invoice.amount_due),
      dueDate: String(invoice.due_date).slice(0, 10),
      description: `Portal invoice${invoice.invoice_number ? ` ${invoice.invoice_number}` : ""}`,
    });

    const qboState = extractQuickBooksInvoiceState(qboInvoice);

    // Attempt to download the invoice PDF; failures are non-fatal.
    let pdfPayload: { data: Buffer; mimeType: string; filename: string; size: number } | null = null;
    try {
      pdfPayload = await getQuickBooksInvoicePdf(connection.realm_id, qboState.qboInvoiceId);
    } catch {
      // PDF download failure should not block invoice creation.
    }

    return updateInvoiceQuickBooksData({
      invoiceId: String(invoice.id),
      qboInvoiceId: qboState.qboInvoiceId,
      qboDocNumber: qboState.qboDocNumber,
      qboPaymentUrl: qboState.paymentUrl,
      qboSyncStatus: qboState.qboSyncStatus,
      amountPaid: qboState.amountPaid,
      paidAt: qboState.paidAt,
      pdfData: pdfPayload?.data ?? null,
      pdfMimeType: pdfPayload?.mimeType ?? null,
      pdfFilename: pdfPayload?.filename ?? null,
      pdfSize: pdfPayload?.size ?? null,
    });
  }

  const qboInvoice = await getQuickBooksInvoice(connection.realm_id, String(invoice.qbo_invoice_id));
  const qboState = extractQuickBooksInvoiceState(qboInvoice);

  await updateInvoiceStatusByQuickBooksInvoiceId({
    qboInvoiceId: qboState.qboInvoiceId,
    qboDocNumber: qboState.qboDocNumber,
    qboSyncStatus: qboState.qboSyncStatus,
    amountPaid: qboState.amountPaid,
    paidAt: qboState.paidAt,
    qboPaymentUrl: qboState.paymentUrl,
  });

  return getInvoiceById(String(invoice.id));
}

export async function syncInvoiceByQuickBooksInvoiceId(qboInvoiceId: string) {
  const connection = await getQuickBooksConnection();
  if (!connection) {
    return null;
  }

  const qboInvoice = await getQuickBooksInvoice(connection.realm_id, qboInvoiceId);
  const qboState = extractQuickBooksInvoiceState(qboInvoice);

  return updateInvoiceStatusByQuickBooksInvoiceId({
    qboInvoiceId: qboState.qboInvoiceId,
    qboDocNumber: qboState.qboDocNumber,
    qboSyncStatus: qboState.qboSyncStatus,
    amountPaid: qboState.amountPaid,
    paidAt: qboState.paidAt,
    qboPaymentUrl: qboState.paymentUrl,
  });
}

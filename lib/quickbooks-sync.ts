import {
  getClientQboInvoiceIds,
  getClientQuickBooksProfile,
  getInvoiceById,
  getQuickBooksConnection,
  setClientQuickBooksCustomerId,
  updateInvoiceQuickBooksData,
  updateInvoiceStatusByQuickBooksInvoiceId,
  createInvoice,
  checkDuplicateByQboInvoiceId,
} from "@/lib/db";
import {
  createQuickBooksCustomer,
  createQuickBooksInvoice,
  extractQuickBooksInvoiceState,
  findQuickBooksCustomerByDisplayName,
  findQuickBooksInvoiceByDocNumber,
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

/**
 * Builds a sanitized PDF filename in the format `invoice_date-qbo_doc_number.pdf`.
 * Falls back to safe placeholder values if either piece is missing.
 */
function buildPdfFilename(invoiceDate: string | null, qboDocNumber: string | null): string {
  const date = invoiceDate ? invoiceDate.slice(0, 10) : "unknown-date";
  const docNumber = qboDocNumber ? String(qboDocNumber) : "unknown";
  const safe = `${date}-${docNumber}`.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
  return `${safe}.pdf`;
}

function getQuickBooksInvoiceCustomerId(invoice: Record<string, unknown>) {
  const customerRef = invoice.CustomerRef as { value?: string } | undefined;
  return customerRef?.value ? String(customerRef.value) : null;
}

export async function syncInvoiceToQuickBooks(localInvoiceId: string, invoiceOverride?: Record<string, unknown>) {
  const invoice = invoiceOverride || await getInvoiceById(localInvoiceId);
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
      invoiceDate: invoice.invoice_date ? String(invoice.invoice_date).slice(0, 10) : undefined,
      dueDate: String(invoice.due_date).slice(0, 10),
      description: `Portal invoice${invoice.invoice_number ? ` ${invoice.invoice_number}` : ""}`,
      itemId: invoice.qbo_item_id ? String(invoice.qbo_item_id) : undefined,
    });

    const qboState = extractQuickBooksInvoiceState(qboInvoice);

    // Attempt to download the invoice PDF; failures are non-fatal.
    let pdfPayload: { data: Buffer; mimeType: string; filename: string; size: number } | null = null;
    try {
      pdfPayload = await getQuickBooksInvoicePdf(connection.realm_id, qboState.qboInvoiceId);
      // Override the filename to use invoice_date-qbo_doc_number format.
      pdfPayload = {
        ...pdfPayload,
        filename: buildPdfFilename(qboState.invoiceDate, qboState.qboDocNumber),
      };
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
      invoiceDate: qboState.invoiceDate,
      invoiceTotal: qboState.invoiceTotal,
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
    invoiceDate: qboState.invoiceDate,
    invoiceTotal: qboState.invoiceTotal,
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
    invoiceDate: qboState.invoiceDate,
    invoiceTotal: qboState.invoiceTotal,
  });
}

/**
 * Links an existing QuickBooks invoice to a local client account by performing a
 * server-side QBO lookup constrained to the client's QBO customer identity.
 */
export async function linkInvoiceByDocNumber(clientId: string, qboDocNumber: string) {
  const client = await getClientQuickBooksProfile(clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
  }

  // Require the client to already have a QBO customer ID; we will not create one here.
  if (!client.qbo_customer_id) {
    throw new Error(
      "This client does not have a QuickBooks customer ID. Create an invoice for this client using the QuickBooks mode first."
    );
  }

  const customerId = String(client.qbo_customer_id);
  const qboInvoice = await findQuickBooksInvoiceByDocNumber(
    connection.realm_id,
    qboDocNumber,
    customerId
  );

  if (!qboInvoice) {
    throw Object.assign(
      new Error(`No QuickBooks invoice found with invoice number "${qboDocNumber}" for this client.`),
      { code: "NOT_FOUND" }
    );
  }

  const qboState = extractQuickBooksInvoiceState(qboInvoice);

  // Duplicate check: has this QBO invoice already been linked for this client?
  const isDuplicate = await checkDuplicateByQboInvoiceId(clientId, qboState.qboInvoiceId);
  if (isDuplicate) {
    throw Object.assign(
      new Error("This QuickBooks invoice is already linked to this client."),
      { code: "DUPLICATE" }
    );
  }

  // Determine due date from QBO DueDate or fall back to today.
  const dueDate =
    typeof qboInvoice.DueDate === "string" && qboInvoice.DueDate
      ? qboInvoice.DueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const invoice = await createInvoice({
    client_id: clientId,
    amount_due: toNumber(qboInvoice.TotalAmt),
    invoice_date: qboState.invoiceDate,
    due_date: dueDate,
    invoice_total: qboState.invoiceTotal,
    qbo_invoice_id: qboState.qboInvoiceId,
    qbo_doc_number: qboState.qboDocNumber,
    qbo_payment_url: qboState.paymentUrl,
    qbo_sync_status: qboState.qboSyncStatus,
    amount_paid: qboState.amountPaid,
    paid_at: qboState.paidAt,
    is_manual_link: true,
  });

  // Attempt to download the invoice PDF; failures are non-fatal.
  let pdfPayload: { data: Buffer; mimeType: string; filename: string; size: number } | null = null;
  try {
    pdfPayload = await getQuickBooksInvoicePdf(connection.realm_id, qboState.qboInvoiceId);
    pdfPayload = {
      ...pdfPayload,
      filename: buildPdfFilename(qboState.invoiceDate, qboState.qboDocNumber),
    };
  } catch {
    // PDF download failure should not block invoice linking.
  }

  if (pdfPayload) {
    return updateInvoiceQuickBooksData({
      invoiceId: String(invoice.id),
      qboInvoiceId: qboState.qboInvoiceId,
      qboDocNumber: qboState.qboDocNumber,
      qboPaymentUrl: qboState.paymentUrl,
      qboSyncStatus: qboState.qboSyncStatus,
      amountPaid: qboState.amountPaid,
      paidAt: qboState.paidAt,
      invoiceDate: qboState.invoiceDate,
      invoiceTotal: qboState.invoiceTotal,
      pdfData: pdfPayload.data,
      pdfMimeType: pdfPayload.mimeType,
      pdfFilename: pdfPayload.filename,
      pdfSize: pdfPayload.size,
    });
  }

  return invoice;
}

export async function linkInvoiceById(options: {
  clientId: string;
  qboCustomerId?: string;
  qboInvoiceId: string;
}) {
  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
  }

  const resolvedClientId = String(options.clientId);
  const client = await getClientQuickBooksProfile(resolvedClientId);
  if (!client) {
    throw new Error("Client not found");
  }

  let customerId: string;
  if (options.qboCustomerId) {
    customerId = String(options.qboCustomerId);
    if (client.qbo_customer_id && String(client.qbo_customer_id) !== customerId) {
      throw new Error(
        `This client is already linked to QuickBooks customer ${String(client.qbo_customer_id)} and cannot be linked to ${customerId}.`
      );
    }
    if (!client.qbo_customer_id) {
      await setClientQuickBooksCustomerId(resolvedClientId, customerId);
    }
  } else {
    if (!client.qbo_customer_id) {
      throw new Error(
        "This client does not have a QuickBooks customer ID. Use New QBO Client mode and select a QuickBooks customer."
      );
    }
    customerId = String(client.qbo_customer_id);
  }

  let qboInvoice: Record<string, unknown>;
  try {
    qboInvoice = await getQuickBooksInvoice(connection.realm_id, options.qboInvoiceId);
  } catch (error) {
    throw Object.assign(
      new Error(`No QuickBooks invoice found with invoice ID "${options.qboInvoiceId}".`),
      { code: "NOT_FOUND", cause: error }
    );
  }

  const invoiceCustomerId = getQuickBooksInvoiceCustomerId(qboInvoice);
  if (!invoiceCustomerId || invoiceCustomerId !== customerId) {
    throw Object.assign(
      new Error(`No QuickBooks invoice found with invoice ID "${options.qboInvoiceId}" for this client.`),
      { code: "NOT_FOUND" }
    );
  }

  const qboState = extractQuickBooksInvoiceState(qboInvoice);
  const isDuplicate = await checkDuplicateByQboInvoiceId(resolvedClientId, qboState.qboInvoiceId);
  if (isDuplicate) {
    throw Object.assign(
      new Error("This QuickBooks invoice is already linked to this client."),
      { code: "DUPLICATE" }
    );
  }

  const dueDate =
    typeof qboInvoice.DueDate === "string" && qboInvoice.DueDate
      ? qboInvoice.DueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const invoice = await createInvoice({
    client_id: resolvedClientId,
    amount_due: toNumber(qboInvoice.TotalAmt),
    invoice_date: qboState.invoiceDate,
    due_date: dueDate,
    invoice_total: qboState.invoiceTotal,
    qbo_invoice_id: qboState.qboInvoiceId,
    qbo_doc_number: qboState.qboDocNumber,
    qbo_payment_url: qboState.paymentUrl,
    qbo_sync_status: qboState.qboSyncStatus,
    amount_paid: qboState.amountPaid,
    paid_at: qboState.paidAt,
    is_manual_link: true,
  });

  let pdfPayload: { data: Buffer; mimeType: string; filename: string; size: number } | null = null;
  try {
    pdfPayload = await getQuickBooksInvoicePdf(connection.realm_id, qboState.qboInvoiceId);
    pdfPayload = {
      ...pdfPayload,
      filename: buildPdfFilename(qboState.invoiceDate, qboState.qboDocNumber),
    };
  } catch {
    // PDF download failure should not block invoice linking.
  }

  if (pdfPayload) {
    return updateInvoiceQuickBooksData({
      invoiceId: String(invoice.id),
      qboInvoiceId: qboState.qboInvoiceId,
      qboDocNumber: qboState.qboDocNumber,
      qboPaymentUrl: qboState.paymentUrl,
      qboSyncStatus: qboState.qboSyncStatus,
      amountPaid: qboState.amountPaid,
      paidAt: qboState.paidAt,
      invoiceDate: qboState.invoiceDate,
      invoiceTotal: qboState.invoiceTotal,
      pdfData: pdfPayload.data,
      pdfMimeType: pdfPayload.mimeType,
      pdfFilename: pdfPayload.filename,
      pdfSize: pdfPayload.size,
    });
  }

  return invoice;
}

export async function syncClientInvoicesFromQuickBooks(clientId: string) {
  const connection = await getQuickBooksConnection();
  if (!connection) {
    return { synced: 0, failed: 0 };
  }

  const qboInvoiceIds = await getClientQboInvoiceIds(clientId);
  let synced = 0;
  let failed = 0;

  for (const qboInvoiceId of qboInvoiceIds) {
    try {
      await syncInvoiceByQuickBooksInvoiceId(qboInvoiceId);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}

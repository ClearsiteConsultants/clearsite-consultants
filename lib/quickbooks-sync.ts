import {
  createMissingPaymentUrlLogIfNeeded,
  getClientQboInvoiceIds,
  getClientQuickBooksProfile,
  getInvoiceById,
  getInvoiceByQuickBooksInvoiceId,
  getQuickBooksConnection,
  type MissingPaymentUrlLogOrigin,
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
  sendQuickBooksInvoiceEmail,
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
            billingAddress: {
              line1: client.billing_address_line1 || undefined,
              line2: client.billing_address_line2 || undefined,
              city: client.billing_city || undefined,
              countrySubDivisionCode: client.billing_state || undefined,
              postalCode: client.billing_postal_code || undefined,
              // country removed (US only)
            },
          })
        ).Id
      );

  await setClientQuickBooksCustomerId(String(client.id), customerId);
  return customerId;
}

function getQuickBooksInvoiceCustomerId(invoice: Record<string, unknown>) {
  const customerRef = invoice.CustomerRef as { value?: string } | undefined;
  return customerRef?.value ? String(customerRef.value) : null;
}

function toYyyyMmDd(value: unknown) {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
  }

  return undefined;
}

type SyncContext = {
  origin: MissingPaymentUrlLogOrigin;
  route: string;
  method: string;
};

const DEFAULT_CONTEXT_BY_ORIGIN: Record<MissingPaymentUrlLogOrigin, { route: string; method: string }> = {
  "admin-create": { route: "/api/invoices", method: "POST" },
  "admin-link": { route: "/api/invoices", method: "POST" },
  "admin-sync": { route: "/api/invoices/[id]/sync", method: "POST" },
  "portal-read": { route: "/api/invoices", method: "GET" },
  "qbo-webhook": { route: "/api/webhooks/quickbooks", method: "POST" },
};

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0;
}

function resolveSyncContext(context: Partial<SyncContext> | undefined, fallbackOrigin: MissingPaymentUrlLogOrigin): SyncContext {
  const origin = context?.origin ?? fallbackOrigin;
  const defaults = DEFAULT_CONTEXT_BY_ORIGIN[origin];
  return {
    origin,
    route: context?.route || defaults.route,
    method: context?.method || defaults.method,
  };
}

async function maybeLogMissingPaymentUrl(input: {
  invoice: Record<string, unknown> | null;
  paymentUrl: string | null | undefined;
  previousPaymentUrl?: string | null;
  context: SyncContext;
}) {
  const invoice = input.invoice;
  if (!invoice) return null;

  // Check the committed value from the database record first.
  const databasePaymentUrl = typeof invoice.qbo_payment_url === 'string' ? invoice.qbo_payment_url : '';
  const hasMissingPaymentUrl = isBlank(databasePaymentUrl) && isBlank(input.paymentUrl);

  if (!hasMissingPaymentUrl) {
    return null;
  }

  const webhookTransitionToMissing =
    input.context.origin === "qbo-webhook"
      ? !isBlank(input.previousPaymentUrl) && hasMissingPaymentUrl
      : true;

  if (!webhookTransitionToMissing) {
    return null;
  }

  return createMissingPaymentUrlLogIfNeeded({
    route: input.context.route,
    method: input.context.method,
    origin: input.context.origin,
    invoiceId: String(invoice.id ?? ""),
    clientId: String(invoice.client_id ?? ""),
    qboDocNumber: typeof invoice.qbo_doc_number === "string" ? invoice.qbo_doc_number : null,
    qboInvoiceId: typeof invoice.qbo_invoice_id === "string" ? invoice.qbo_invoice_id : null,
    qboSyncStatus: typeof invoice.qbo_sync_status === "string" ? invoice.qbo_sync_status : null,
    cooldownMinutes: input.context.origin === "portal-read" ? 720 : 60,
  });
}

export async function syncInvoiceToQuickBooks(
  localInvoiceId: string,
  invoiceOverride?: Record<string, unknown>,
  context?: Partial<SyncContext>
) {
  const syncContext = resolveSyncContext(context, "admin-sync");
  const invoice = invoiceOverride || await getInvoiceById(localInvoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
  }

  if (!invoice.qbo_invoice_id) {
    const clientId = String(invoice.client_id);
    const client = await getClientQuickBooksProfile(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const customerId = await ensureQuickBooksCustomer(clientId);
    // qbo_doc_number may be null — let QuickBooks auto-generate the DocNumber
    const qboInvoice = await createQuickBooksInvoice(connection.realm_id, {
      customerId,
      invoiceNumber: invoice.qbo_doc_number ? String(invoice.qbo_doc_number) : undefined,
      amountDue: toNumber(invoice.invoice_total),
      invoiceDate: toYyyyMmDd(invoice.invoice_date),
      dueDate: toYyyyMmDd(invoice.due_date) || String(invoice.due_date).slice(0, 10),
      description: `Portal invoice${invoice.qbo_doc_number ? ` ${invoice.qbo_doc_number}` : ""}`,
      itemId: invoice.qbo_item_id ? String(invoice.qbo_item_id) : undefined,
      email: client.email || undefined,
    });

    const qboState = extractQuickBooksInvoiceState(qboInvoice);

    const updatedInvoice = await updateInvoiceQuickBooksData({
      invoiceId: String(invoice.id),
      qboInvoiceId: qboState.qboInvoiceId,
      qboDocNumber: qboState.qboDocNumber,
      qboPaymentUrl: qboState.paymentUrl,
      qboSyncStatus: qboState.qboSyncStatus,
      amountPaid: qboState.amountPaid,
      paidAt: qboState.paidAt,
      invoiceDate: qboState.invoiceDate,
      invoiceTotal: qboState.invoiceTotal,
    });

    // Trigger QuickBooks "Review and Send" email
    if (client.email) {
      try {
        await sendQuickBooksInvoiceEmail(connection.realm_id, qboState.qboInvoiceId, client.email);
      } catch (emailError) {
        console.error("Failed to send QuickBooks invoice email:", emailError);
      }
    }

    await maybeLogMissingPaymentUrl({
      invoice: updatedInvoice,
      paymentUrl: qboState.paymentUrl,
      context: syncContext,
    });

    return updatedInvoice;
  }

  const qboInvoice = await getQuickBooksInvoice(connection.realm_id, String(invoice.qbo_invoice_id));
  const qboState = extractQuickBooksInvoiceState(qboInvoice);

  const updatedInvoice = await updateInvoiceStatusByQuickBooksInvoiceId({
    qboInvoiceId: qboState.qboInvoiceId,
    qboDocNumber: qboState.qboDocNumber,
    qboSyncStatus: qboState.qboSyncStatus,
    amountPaid: qboState.amountPaid,
    paidAt: qboState.paidAt,
    qboPaymentUrl: qboState.paymentUrl,
    invoiceDate: qboState.invoiceDate,
    invoiceTotal: qboState.invoiceTotal,
    allowPaymentUrlClear: syncContext.origin === "qbo-webhook",
  });

  await maybeLogMissingPaymentUrl({
    invoice: updatedInvoice,
    paymentUrl: qboState.paymentUrl,
    previousPaymentUrl: typeof invoice.qbo_payment_url === "string" ? invoice.qbo_payment_url : null,
    context: syncContext,
  });

  return updatedInvoice ?? getInvoiceById(String(invoice.id));
}

export async function syncInvoiceByQuickBooksInvoiceId(qboInvoiceId: string, context?: Partial<SyncContext>) {
  const syncContext = resolveSyncContext(context, "qbo-webhook");
  const connection = await getQuickBooksConnection();
  if (!connection) {
    return null;
  }

  const qboInvoice = await getQuickBooksInvoice(connection.realm_id, qboInvoiceId);
  const qboState = extractQuickBooksInvoiceState(qboInvoice);

  const previousInvoice = await getInvoiceByQuickBooksInvoiceId(qboState.qboInvoiceId);
  const previousPaymentUrl =
    typeof previousInvoice?.qbo_payment_url === "string" ? previousInvoice.qbo_payment_url : null;

  const updatedInvoice = await updateInvoiceStatusByQuickBooksInvoiceId({
    qboInvoiceId: qboState.qboInvoiceId,
    qboDocNumber: qboState.qboDocNumber,
    qboSyncStatus: qboState.qboSyncStatus,
    amountPaid: qboState.amountPaid,
    paidAt: qboState.paidAt,
    qboPaymentUrl: qboState.paymentUrl,
    invoiceDate: qboState.invoiceDate,
    invoiceTotal: qboState.invoiceTotal,
    allowPaymentUrlClear: syncContext.origin === "qbo-webhook",
  });

  await maybeLogMissingPaymentUrl({
    invoice: updatedInvoice,
    paymentUrl: qboState.paymentUrl,
    previousPaymentUrl,
    context: syncContext,
  });

  return updatedInvoice;
}

/**
 * Links an existing QuickBooks invoice to a local client account by performing a
 * server-side QBO lookup constrained to the client's QBO customer identity.
 */
export async function linkInvoiceByDocNumber(options: {
  clientId: string;
  qboDocNumber: string;
  qboCustomerId?: string;
}, context?: Partial<SyncContext>) {
  const syncContext = resolveSyncContext(context, "admin-link");
  const resolvedClientId = String(options.clientId);
  const client = await getClientQuickBooksProfile(resolvedClientId);
  if (!client) {
    throw new Error("Client not found");
  }

  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
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
        "This client does not have a QuickBooks customer ID. Please ensure this client has been linked to a QuickBooks customer first."
      );
    }
    customerId = String(client.qbo_customer_id);
  }

  const qboInvoice = await findQuickBooksInvoiceByDocNumber(
    connection.realm_id,
    String(options.qboDocNumber).trim(),
    customerId
  );

  if (!qboInvoice) {
    throw Object.assign(
      new Error(`No QuickBooks invoice found with invoice number "${String(options.qboDocNumber).trim()}" for this client.`),
      { code: "NOT_FOUND" }
    );
  }

  const qboState = extractQuickBooksInvoiceState(qboInvoice);

  // Duplicate check: has this QBO invoice already been linked for this client?
  const isDuplicate = await checkDuplicateByQboInvoiceId(resolvedClientId, qboState.qboInvoiceId);
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
    client_id: resolvedClientId,
    invoice_total: qboState.invoiceTotal,
    invoice_date: qboState.invoiceDate,
    due_date: dueDate,
    qbo_invoice_id: qboState.qboInvoiceId,
    qbo_doc_number: qboState.qboDocNumber,
    qbo_payment_url: qboState.paymentUrl,
    qbo_sync_status: qboState.qboSyncStatus,
    amount_paid: qboState.amountPaid,
    paid_at: qboState.paidAt,
    is_manual_link: true,
  });

  // Trigger QuickBooks "Review and Send" email
  if (client.email) {
    try {
      await sendQuickBooksInvoiceEmail(connection.realm_id, qboState.qboInvoiceId, client.email);
    } catch (emailError) {
      console.error("Failed to send QuickBooks invoice email after link (by DocNumber):", emailError);
    }
  }

  await maybeLogMissingPaymentUrl({
    invoice,
    paymentUrl: qboState.paymentUrl,
    context: syncContext,
  });

  return invoice;
}

export async function linkInvoiceById(options: {
  clientId: string;
  qboCustomerId?: string;
  qboInvoiceId: string;
}, context?: Partial<SyncContext>) {
  const syncContext = resolveSyncContext(context, "admin-link");
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
        "This client does not have a QuickBooks customer ID. Please ensure this client has been linked to a QuickBooks customer first."
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
    invoice_total: qboState.invoiceTotal,
    invoice_date: qboState.invoiceDate,
    due_date: dueDate,
    qbo_invoice_id: qboState.qboInvoiceId,
    qbo_doc_number: qboState.qboDocNumber,
    qbo_payment_url: qboState.paymentUrl,
    qbo_sync_status: qboState.qboSyncStatus,
    amount_paid: qboState.amountPaid,
    paid_at: qboState.paidAt,
    is_manual_link: true,
  });

  // Trigger QuickBooks "Review and Send" email
  if (client.email) {
    try {
      await sendQuickBooksInvoiceEmail(connection.realm_id, qboState.qboInvoiceId, client.email);
    } catch (emailError) {
      console.error("Failed to send QuickBooks invoice email after link (by ID):", emailError);
    }
  }

  await maybeLogMissingPaymentUrl({
    invoice,
    paymentUrl: qboState.paymentUrl,
    context: syncContext,
  });

  return invoice;
}

export async function syncClientInvoicesFromQuickBooks(clientId: string, context?: Partial<SyncContext>) {
  const syncContext = resolveSyncContext(context, "portal-read");
  const connection = await getQuickBooksConnection();
  if (!connection) {
    return { synced: 0, failed: 0 };
  }

  const qboInvoiceIds = await getClientQboInvoiceIds(clientId);
  let synced = 0;
  let failed = 0;

  for (const qboInvoiceId of qboInvoiceIds) {
    try {
      await syncInvoiceByQuickBooksInvoiceId(qboInvoiceId, syncContext);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}

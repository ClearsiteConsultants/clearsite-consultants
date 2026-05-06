import crypto from "crypto";
import { getQuickBooksConnection, upsertQuickBooksConnection } from "@/lib/db";

type QuickBooksTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
};

type QuickBooksConnection = {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  connected_by_user_id?: string | null;
};

function getQuickBooksEnv() {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox";
}

function getOAuthConfig() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("QuickBooks OAuth environment variables are missing");
  }

  return { clientId, clientSecret, redirectUri };
}

function getApiBaseUrl() {
  return getQuickBooksEnv() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

function getStateSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required to sign QuickBooks OAuth state");
  }
  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function makeStateSignature(payload: string) {
  return crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function createQuickBooksOAuthState(userId: string) {
  const payload = toBase64Url(JSON.stringify({ userId, ts: Date.now() }));
  return `${payload}.${makeStateSignature(payload)}`;
}

export function verifyQuickBooksOAuthState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expectedSig = makeStateSignature(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const parsed = JSON.parse(fromBase64Url(payload)) as { userId: string; ts: number };
  if (!parsed?.userId || !parsed?.ts) return null;

  // State expires after 10 minutes.
  if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;

  return parsed;
}

export function buildQuickBooksAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = getOAuthConfig();
  const authorizeBase = getQuickBooksEnv() === "production"
    ? "https://appcenter.intuit.com/connect/oauth2"
    : "https://appcenter.intuit.com/connect/oauth2";

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state,
  });

  return `${authorizeBase}?${params.toString()}`;
}

async function tokenRequest(params: URLSearchParams) {
  const { clientId, clientSecret } = getOAuthConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`QuickBooks token exchange failed: ${JSON.stringify(payload)}`);
  }

  return payload as QuickBooksTokenResponse;
}

export async function exchangeCodeForTokens(code: string) {
  const { redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  return tokenRequest(params);
}

export async function refreshQuickBooksTokens(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return tokenRequest(params);
}

export async function getFreshQuickBooksConnection(): Promise<QuickBooksConnection> {
  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new Error("QuickBooks is not connected yet");
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (expiresAt > Date.now() + 2 * 60 * 1000) {
    return connection as QuickBooksConnection;
  }

  const refreshed = await refreshQuickBooksTokens(connection.refresh_token);
  const updated = await upsertQuickBooksConnection({
    realmId: connection.realm_id,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    connectedByUserId: connection.connected_by_user_id || null,
  });

  return updated as QuickBooksConnection;
}

export async function quickBooksApiRequest<T>(options: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  contentType?: string;
}) {
  const connection = await getFreshQuickBooksConnection();
  const response = await fetch(`${getApiBaseUrl()}${options.path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
      "Content-Type": options.contentType || "application/json",
    },
    body: options.body
      ? options.contentType === "text/plain"
        ? String(options.body)
        : JSON.stringify(options.body)
      : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`QuickBooks API error: ${JSON.stringify(payload)}`);
  }

  return payload as T;
}

function escapeQuickBooksQueryValue(value: string) {
  // QBO IDS query language uses doubled single-quotes for escaping, not backslash
  return String(value).replace(/'/g, "''");
}

export async function findQuickBooksCustomerByDisplayName(realmId: string, displayName: string) {
  const query = `select * from Customer where DisplayName = '${escapeQuickBooksQueryValue(displayName)}' maxresults 1`;
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
    },
  });
  const result = await response.json() as { QueryResponse?: { Customer?: Array<{ Id: string }> } };
  if (!response.ok) {
    throw new Error(`QuickBooks API error: ${JSON.stringify(result)}`);
  }
  return result.QueryResponse?.Customer?.[0] || null;
}

export async function createQuickBooksCustomer(realmId: string, data: {
  displayName: string;
  email?: string;
  phone?: string;
  website?: string;
}) {
  const payload = {
    DisplayName: data.displayName,
    PrimaryEmailAddr: data.email ? { Address: data.email } : undefined,
    PrimaryPhone: data.phone ? { FreeFormNumber: data.phone } : undefined,
    WebAddr: data.website ? { URI: data.website } : undefined,
  };

  const result = await quickBooksApiRequest<{ Customer: { Id: string } }>({
    method: "POST",
    path: `/v3/company/${realmId}/customer?minorversion=75`,
    body: payload,
  });

  return result.Customer;
}

export async function createQuickBooksInvoice(realmId: string, data: {
  customerId: string;
  invoiceNumber?: string;
  amountDue: number;
  invoiceDate?: string;
  dueDate: string;
  description: string;
  itemId?: string;
}) {
  const defaultItemId = data.itemId || process.env.QUICKBOOKS_DEFAULT_ITEM_ID;
  if (!defaultItemId) {
    throw new Error("QUICKBOOKS_DEFAULT_ITEM_ID is required to create invoices in QuickBooks");
  }

  const payload = {
    CustomerRef: { value: data.customerId },
    ...(data.invoiceNumber ? { DocNumber: data.invoiceNumber } : {}),
    ...(data.invoiceDate ? { TxnDate: data.invoiceDate } : {}),
    DueDate: data.dueDate,
    PrivateNote: data.description,
    Line: [
      {
        Amount: data.amountDue,
        DetailType: "SalesItemLineDetail",
        Description: data.description,
        SalesItemLineDetail: {
          ItemRef: { value: defaultItemId },
        },
      },
    ],
  };

  const result = await quickBooksApiRequest<{ Invoice: Record<string, unknown> }>({
    method: "POST",
    path: `/v3/company/${realmId}/invoice?minorversion=75`,
    body: payload,
  });

  return result.Invoice;
}

export async function getQuickBooksInvoice(realmId: string, qboInvoiceId: string) {
  const result = await quickBooksApiRequest<{ Invoice: Record<string, unknown> }>({
    method: "GET",
    path: `/v3/company/${realmId}/invoice/${qboInvoiceId}?minorversion=75`,
  });

  return result.Invoice;
}

export type QuickBooksItem = {
  Id: string;
  Name: string;
  UnitPrice: number;
  Taxable: boolean;
  Active: boolean;
  Type: string;
};

export async function getQuickBooksItems(realmId: string): Promise<QuickBooksItem[]> {
  const query = "SELECT Id, Name, UnitPrice, Taxable, Active, Type FROM Item WHERE Active = true MAXRESULTS 200";
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
    },
  });
  const result = await response.json() as { QueryResponse?: { Item?: Array<Record<string, unknown>> } };
  if (!response.ok) {
    throw new Error(`QuickBooks API error: ${JSON.stringify(result)}`);
  }
  const items = result.QueryResponse?.Item || [];
  return items.map((item) => ({
    Id: String(item.Id || ""),
    Name: String(item.Name || ""),
    UnitPrice: Number(item.UnitPrice ?? 0),
    Taxable: Boolean(item.Taxable),
    Active: Boolean(item.Active),
    Type: String(item.Type || ""),
  }));
}

export async function findQuickBooksInvoiceByDocNumber(
  realmId: string,
  docNumber: string,
  customerId?: string
): Promise<Record<string, unknown> | null> {
  const safeDocNumber = escapeQuickBooksQueryValue(docNumber);
  const query = `SELECT * FROM Invoice WHERE DocNumber = '${safeDocNumber}' MAXRESULTS 5`;
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
    },
  });
  const result = await response.json() as { QueryResponse?: { Invoice?: Array<Record<string, unknown>> } };
  if (!response.ok) {
    throw new Error(`QuickBooks API error: ${JSON.stringify(result)}`);
  }
  const invoices = result.QueryResponse?.Invoice || [];
  if (invoices.length === 0) return null;

  if (customerId) {
    // Constrain to the specified customer.
    const match = invoices.find((inv) => {
      const ref = inv.CustomerRef as { value?: string } | undefined;
      return ref?.value === customerId;
    });
    return match ?? null;
  }

  return invoices[0];
}

export async function getQuickBooksInvoicePdf(realmId: string, qboInvoiceId: string): Promise<{
  data: Buffer;
  mimeType: string;
  filename: string;
  size: number;
}> {
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/invoice/${qboInvoiceId}/pdf?minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QuickBooks PDF download failed (${response.status}): ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get("content-type") || "application/pdf";
  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch = /filename="?([^";\s]+)"?/i.exec(disposition);
  const rawFilename = filenameMatch?.[1] || `invoice-${qboInvoiceId}.pdf`;
  // Sanitize the filename to prevent path traversal or special-character injection.
  const filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");

  return { data, mimeType, filename, size: data.length };
}

export function extractQuickBooksInvoiceState(invoice: Record<string, unknown>) {
  const total = Number(invoice.TotalAmt ?? 0);
  const balance = Number(invoice.Balance ?? total);
  const amountPaid = Math.max(0, total - balance);
  const isPaid = balance <= 0.0001;

  const paymentUrl =
    (typeof invoice.InvoiceLink === "string" && invoice.InvoiceLink) ||
    (typeof invoice.OnlineInvoiceLink === "string" && invoice.OnlineInvoiceLink) ||
    (typeof invoice.InvoiceLinkUrl === "string" && invoice.InvoiceLinkUrl) ||
    null;

  const invoiceDate = typeof invoice.TxnDate === "string" && invoice.TxnDate
    ? invoice.TxnDate.slice(0, 10)
    : null;

  return {
    qboInvoiceId: String(invoice.Id || ""),
    qboDocNumber: invoice.DocNumber ? String(invoice.DocNumber) : null,
    qboSyncStatus: isPaid ? "paid" : "sent",
    amountPaid,
    paidAt: isPaid
      ? String((invoice.MetaData as { LastUpdatedTime?: string } | undefined)?.LastUpdatedTime || new Date().toISOString())
      : null,
    paymentUrl,
    invoiceDate,
    invoiceTotal: total,
  };
}

export function verifyQuickBooksWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken) {
    // Local development mode when the verifier token has not been configured.
    return true;
  }

  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", verifierToken)
    .update(rawBody, "utf8")
    .digest("base64");

  const provided = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

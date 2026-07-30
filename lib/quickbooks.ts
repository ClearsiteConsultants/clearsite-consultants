import crypto from "crypto";
import {
  getQuickBooksConnection,
  setQuickBooksConnectionAuthState,
  upsertQuickBooksConnection,
  QuickBooksConnectionRow,
} from "@/lib/db";
import { persistApiError } from "@/lib/error-logger";

type QuickBooksTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
};

type DiscoveryDocument = {
  authorization_endpoint: string;
  token_endpoint: string;
  [key: string]: unknown;
};

type CachedEndpoints = {
  authorization_endpoint: string;
  token_endpoint: string;
  expiry: number;
};

// Alias the DB row type so internal callers have a stable name.
type QuickBooksConnection = QuickBooksConnectionRow;

// Module-level caches
let cachedEndpoints: CachedEndpoints | null = null;
const termCache: Record<string, { Id: string; Name: string }> = {};

const DISCOVERY_CACHE_TTL_MS = (parseInt(process.env.DISCOVERY_CACHE_TTL_MINUTES || "30", 10) * 60 * 1000);

export type QuickBooksReconnectReason = "missing_connection" | "invalid_grant" | "api_unauthorized";

export class QuickBooksReconnectRequiredError extends Error {
  reconnectRequired = true;
  reconnectReason: QuickBooksReconnectReason;
  reasonCode: string | null;

  constructor(reason: QuickBooksReconnectReason, message = "QuickBooks reconnect is required", reasonCode?: string | null) {
    super(message);
    this.name = "QuickBooksReconnectRequiredError";
    this.reconnectReason = reason;
    this.reasonCode = reasonCode ?? null;
  }
}

export class QuickBooksApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "QuickBooksApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function isQuickBooksNotFoundError(error: unknown): boolean {
  return error instanceof QuickBooksApiError && (error.status === 404 || error.status === 410);
}

export function isQuickBooksReconnectRequiredError(error: unknown): error is QuickBooksReconnectRequiredError {
  if (error instanceof QuickBooksReconnectRequiredError) {
    return true;
  }
  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    if ("reconnectRequired" in errorRecord && errorRecord.reconnectRequired === true) {
      return true;
    }
    if ("name" in errorRecord && errorRecord.name === "QuickBooksReconnectRequiredError") {
      return true;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("reconnect") ||
        msg.includes("token exchange failed") ||
        msg.includes("authorization is no longer valid") ||
        msg.includes("api_unauthorized")
      ) {
        return true;
      }
    }
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function lowerString(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function getTokenErrorCode(payload: unknown) {
  const record = asRecord(payload);
  const code = record?.error;
  return typeof code === "string" ? code : null;
}

function isInvalidGrantTokenPayload(payload: unknown) {
  return lowerString(getTokenErrorCode(payload)) === "invalid_grant";
}

function extractQuickBooksApiErrorCode(payload: unknown): string | null {
  const record = asRecord(payload);
  const fault = asRecord(record?.Fault);
  const errors = Array.isArray(fault?.Error) ? fault?.Error : [];
  const firstError = asRecord(errors[0]);
  const code = firstError?.code;
  return typeof code === "string" ? code : null;
}

function isUnauthorizedApiPayload(payload: unknown) {
  const record = asRecord(payload);
  const fault = asRecord(record?.Fault);
  const errors = Array.isArray(fault?.Error) ? fault?.Error : [];
  const firstError = asRecord(errors[0]);
  const signals = [
    lowerString(fault?.type),
    lowerString(firstError?.Message),
    lowerString(firstError?.Detail),
    lowerString(firstError?.code),
  ].filter(Boolean);
  return signals.some((signal) =>
    signal.includes("auth") || signal.includes("token") || signal.includes("unauthor")
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

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

function getDiscoveryDocumentUrl() {
  const env = getQuickBooksEnv();
  return env === "production"
    ? "https://developer.api.intuit.com/.well-known/openid_configuration"
    : "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration";
}

async function fetchDiscoveryDocument(): Promise<DiscoveryDocument | null> {
  try {
    const url = getDiscoveryDocumentUrl();
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000), // 3-second timeout
    });

    if (!response.ok) {
      console.warn(
        `[QuickBooks] Failed to fetch discovery document (status ${response.status}). Will use hardcoded endpoints.`
      );
      return null;
    }

    const doc = (await response.json()) as DiscoveryDocument;
    return doc;
  } catch (error) {
    console.warn(
      `[QuickBooks] Failed to fetch discovery document: ${error instanceof Error ? error.message : String(error)}. Will use hardcoded endpoints.`
    );
    return null;
  }
}

function validateDiscoveredEndpoints(doc: DiscoveryDocument | null): CachedEndpoints | null {
  if (!doc) return null;

  const { authorization_endpoint, token_endpoint } = doc;

  // Validate both endpoints exist and are strings
  if (typeof authorization_endpoint !== "string" || typeof token_endpoint !== "string") {
    console.warn("[QuickBooks] Discovery document missing required endpoints. Will use hardcoded endpoints.");
    return null;
  }

  // Validate both are HTTPS URLs
  try {
    const authUrl = new URL(authorization_endpoint);
    const tokenUrl = new URL(token_endpoint);

    if (authUrl.protocol !== "https:" || tokenUrl.protocol !== "https:") {
      throw new Error("Endpoints must use HTTPS");
    }

    // Whitelist of trusted Intuit domains
    const trustedDomains = ["appcenter.intuit.com", "oauth.platform.intuit.com", "oauth.intuit.com"];
    const authHostValid = trustedDomains.includes(authUrl.hostname);
    const tokenHostValid = trustedDomains.includes(tokenUrl.hostname);

    if (!authHostValid || !tokenHostValid) {
      throw new Error(
        `Invalid endpoint hostname. Auth: ${authUrl.hostname}, Token: ${tokenUrl.hostname}. Expected one of: ${trustedDomains.join(", ")}`
      );
    }

    return {
      authorization_endpoint,
      token_endpoint,
      expiry: Date.now() + DISCOVERY_CACHE_TTL_MS,
    };
  } catch (error) {
    console.warn(`[QuickBooks] Invalid discovery document endpoints: ${error instanceof Error ? error.message : String(error)}. Will use hardcoded endpoints.`);
    return null;
  }
}

async function getCachedEndpoints(): Promise<CachedEndpoints | null> {
  // Return cached endpoints if still valid
  if (cachedEndpoints && cachedEndpoints.expiry > Date.now()) {
    return cachedEndpoints;
  }

  // Fetch fresh discovery document
  const doc = await fetchDiscoveryDocument();
  const validated = validateDiscoveredEndpoints(doc);

  if (validated) {
    cachedEndpoints = validated;
    return validated;
  }

  return null;
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

export async function buildQuickBooksAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = getOAuthConfig();
  
  // Try to use discovered endpoint, fall back to hardcoded
  let authorizationEndpoint = "https://appcenter.intuit.com/connect/oauth2";
  const discovered = await getCachedEndpoints();
  if (discovered) {
    authorizationEndpoint = discovered.authorization_endpoint;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state,
  });

  return `${authorizationEndpoint}?${params.toString()}`;
}

async function tokenRequest(params: URLSearchParams) {
  const { clientId, clientSecret } = getOAuthConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  // Try to use discovered endpoint, fall back to hardcoded
  let tokenEndpoint = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
  const discovered = await getCachedEndpoints();
  if (discovered) {
    tokenEndpoint = discovered.token_endpoint;
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    if (isInvalidGrantTokenPayload(payload)) {
      throw new QuickBooksReconnectRequiredError("invalid_grant", "QuickBooks authorization is no longer valid", "invalid_grant");
    }
    throw new Error("QuickBooks token exchange failed");
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

  return await tokenRequest(params);
}

export async function refreshQuickBooksTokens(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return await tokenRequest(params);
}

async function markReconnectRequired(connection: QuickBooksConnection, reason: QuickBooksReconnectReason, reasonCode?: string | null) {
  await setQuickBooksConnectionAuthState({
    realmId: connection.realm_id,
    reconnectRequired: true,
    reconnectReason: reason,
    lastAuthErrorCode: reasonCode ?? null,
  });
}

async function throwQuickBooksApiError(connection: QuickBooksConnection, response: Response, payload: unknown): Promise<never> {
  const payloadRecord = asRecord(payload);
  const unauthorized = (response.status === 401 || response.status === 403)
    && (isUnauthorizedApiPayload(payload) || !payloadRecord || Object.keys(payloadRecord).length === 0);
  if (unauthorized) {
    const reasonCode = extractQuickBooksApiErrorCode(payload);
    await markReconnectRequired(connection, "api_unauthorized", reasonCode);
    throw new QuickBooksReconnectRequiredError(
      "api_unauthorized",
      "QuickBooks authorization is no longer valid",
      reasonCode
    );
  }
  
  // Log the specific fault for debugging
  if (payloadRecord?.Fault) {
    console.error("[QuickBooks API Error Detail]:", JSON.stringify(payloadRecord.Fault, null, 2));
  }
  
  throw new QuickBooksApiError(response.status, "QuickBooks API request failed", payload);
}

export async function getFreshQuickBooksConnection(): Promise<QuickBooksConnection> {
  const connection = await getQuickBooksConnection();
  if (!connection) {
    throw new QuickBooksReconnectRequiredError("missing_connection", "QuickBooks reconnect is required", "missing_connection");
  }

  if (connection.reconnect_required) {
    throw new QuickBooksReconnectRequiredError(
      (connection.reconnect_reason as QuickBooksReconnectReason | null) || "invalid_grant",
      "QuickBooks reconnect is required",
      connection.last_auth_error_code
    );
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (expiresAt > Date.now() + 2 * 60 * 1000) {
    return connection;
  }

  let refreshed: QuickBooksTokenResponse;
  try {
    refreshed = await refreshQuickBooksTokens(connection.refresh_token);
  } catch (error) {
    if (isQuickBooksReconnectRequiredError(error)) {
      await markReconnectRequired(connection, "invalid_grant", error.reasonCode);
    }
    throw error;
  }

  const updated = await upsertQuickBooksConnection({
    realmId: connection.realm_id,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    connectedByUserId: connection.connected_by_user_id || null,
    reconnectRequired: false,
    reconnectReason: null,
    lastAuthErrorCode: null,
    lastAuthErrorAt: null,
  });

  if (!updated) {
    throw new Error("Failed to persist refreshed QuickBooks tokens");
  }

  return updated;
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

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    await throwQuickBooksApiError(connection, response, payload);
  }

  return payload as T;
}

function escapeQuickBooksQueryValue(value: string) {
  // QBO IDS query language uses doubled single-quotes for escaping, not backslash
  return String(value).replace(/'/g, "''");
}

function slugifyTermName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
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
  const result = await parseJsonResponse(response) as { QueryResponse?: { Customer?: Array<{ Id: string }> } };
  if (!response.ok) {
    await throwQuickBooksApiError(connection, response, result);
  }
  return result.QueryResponse?.Customer?.[0] || null;
}

export async function createQuickBooksCustomer(realmId: string, data: {
  displayName: string;
  email?: string;
  phone?: string;
  website?: string;
  billingAddress?: QuickBooksBillingAddress;
}) {
  const billAddr = data.billingAddress &&
    (data.billingAddress.line1 ||
      data.billingAddress.line2 ||
      data.billingAddress.city ||
      data.billingAddress.countrySubDivisionCode ||
      data.billingAddress.postalCode ||
      data.billingAddress.country)
    ? {
        Line1: data.billingAddress.line1,
        Line2: data.billingAddress.line2,
        City: data.billingAddress.city,
        CountrySubDivisionCode: data.billingAddress.countrySubDivisionCode,
        PostalCode: data.billingAddress.postalCode,
        Country: data.billingAddress.country,
      }
    : undefined;

  const payload = {
    DisplayName: data.displayName,
    PrimaryEmailAddr: data.email ? { Address: data.email } : undefined,
    PrimaryPhone: data.phone ? { FreeFormNumber: data.phone } : undefined,
    WebAddr: data.website ? { URI: data.website } : undefined,
    BillAddr: billAddr,
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
  itemName?: string;
  email?: string;
  termName?: string;
}, isRetry = false): Promise<Record<string, unknown>> {
  let finalItemId = data.itemId;
  
  if (data.itemName) {
    const resolvedItem = await findQuickBooksItemByName(realmId, data.itemName);
    if (resolvedItem) {
      finalItemId = resolvedItem.Id;
    }
  }

  const defaultItemId = finalItemId || process.env.QUICKBOOKS_DEFAULT_ITEM_ID;
  if (!defaultItemId) {
    throw new Error("QuickBooks Item ID or Name is required to create invoices");
  }

  const termNameToUse = data.termName || "Net 15";
  let term = await findQuickBooksTermByName(realmId, termNameToUse);
  
  // Fallback to "Due on receipt" if Net 15 is missing
  if (!term && termNameToUse !== "Due on receipt") {
    term = await findQuickBooksTermByName(realmId, "Due on receipt");
  }

  if (!term) {
    throw new Error(`QuickBooks terms "${termNameToUse}" and "Due on receipt" are both missing. Cannot create invoice.`);
  }

  const payload = {
    CustomerRef: { value: data.customerId },
    ...(data.invoiceNumber ? { DocNumber: data.invoiceNumber } : { AutoDocNumber: true }),
    ...(data.invoiceDate ? { TxnDate: data.invoiceDate } : {}),
    DueDate: data.dueDate,
    SalesTermRef: { value: term.Id, name: term.Name },
    BillEmail: data.email ? { Address: data.email } : undefined,
    EmailStatus: "NeedToSend",
    PrivateNote: data.description,
    Line: [
      {
        Amount: data.amountDue,
        DetailType: "SalesItemLineDetail",
        Description: data.description,
        SalesItemLineDetail: {
          ItemRef: { value: defaultItemId },
          Qty: 1,
          UnitPrice: data.amountDue,
        },
      },
    ],
  };

  try {
    const result = await quickBooksApiRequest<{ Invoice: Record<string, unknown> }>({
      method: "POST",
      path: `/v3/company/${realmId}/invoice?include=allowonlinelink&minorversion=75`,
      body: payload,
    });

    const createdInvoiceId = typeof result.Invoice?.Id === "string" ? result.Invoice.Id : null;
    if (!createdInvoiceId) {
      return result.Invoice || {};
    }

    return (await getQuickBooksInvoice(realmId, createdInvoiceId)) || {};
  } catch (error) {
    // Handle Duplicate Document Number (6000)
    const isDuplicate = error instanceof Error && error.message.includes("6000");
    if (isDuplicate && !isRetry) {
      console.warn(`[QuickBooks] Duplicate DocNumber detected for customer ${data.customerId}. Retrying with unique number.`);
      return await createQuickBooksInvoice(realmId, {
        ...data,
        invoiceNumber: `M-${Date.now()}`,
      }, true);
    }
    throw error;
  }
}

export async function updateQuickBooksInvoiceLineItem(realmId: string, data: {
  qboInvoiceId: string;
  itemId?: string;
  itemName?: string;
  amountDue: number;
  description: string;
}) {
  let finalItemId = data.itemId;
  if (data.itemName) {
    const resolvedItem = await findQuickBooksItemByName(realmId, data.itemName);
    if (resolvedItem) {
      finalItemId = resolvedItem.Id;
    }
  }

  if (!finalItemId) {
    throw new Error("QuickBooks Item ID or Name is required to update invoice line item");
  }

  const currentInvoice = await getQuickBooksInvoice(realmId, data.qboInvoiceId);
  if (!currentInvoice) {
    throw new Error(`QuickBooks invoice ${data.qboInvoiceId} not found`);
  }

  const oldLine = Array.isArray(currentInvoice.Line) ? (currentInvoice.Line as Record<string, unknown>[]) : [];
  
  const updatedLine = oldLine.map((line: Record<string, unknown>) => {
    if (line.DetailType === "SalesItemLineDetail") {
      const salesItemLineDetail = (line.SalesItemLineDetail as Record<string, unknown>) || {};
      return {
        ...line,
        Amount: data.amountDue,
        Description: data.description,
        SalesItemLineDetail: {
          ...salesItemLineDetail,
          ItemRef: { value: finalItemId },
          Qty: 1,
          UnitPrice: data.amountDue,
        }
      };
    }
    return line;
  });

  const payload = {
    ...currentInvoice,
    sparse: true,
    SyncToken: currentInvoice.SyncToken,
    Line: updatedLine,
  };

  const result = await quickBooksApiRequest<{ Invoice: Record<string, unknown> }>({
    method: "POST",
    path: `/v3/company/${realmId}/invoice?minorversion=75`,
    body: payload,
  });

  return result.Invoice;
}

export async function sendQuickBooksInvoiceEmail(realmId: string, qboInvoiceId: string, emailAddr?: string) {
  const path = `/v3/company/${realmId}/invoice/${qboInvoiceId}/send${emailAddr ? `?sendTo=${encodeURIComponent(emailAddr)}` : ""}`;
  return await quickBooksApiRequest({
    method: "POST",
    path,
    contentType: "application/octet-stream",
  });
}

export async function getQuickBooksInvoice(realmId: string, qboInvoiceId: string) {
  const result = await quickBooksApiRequest<{ Invoice: Record<string, unknown> }>({
    method: "GET",
    path: `/v3/company/${realmId}/invoice/${qboInvoiceId}?include=allowonlinelink&minorversion=75`,
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

export type QuickBooksCustomer = {
  Id: string;
  DisplayName: string;
  CompanyName: string;
  Active: boolean;
};

export type QuickBooksCustomerDetail = {
  Id: string;
  DisplayName: string;
  CompanyName: string;
  SyncToken?: string;
  GivenName?: string;
  FamilyName?: string;
  Active: boolean;
  PrimaryEmailAddr?: {
    Address?: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  WebAddr?: {
    URI?: string;
  };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
};

export type QuickBooksBillingAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  countrySubDivisionCode?: string;
  postalCode?: string;
  country?: string;
};

export async function getQuickBooksCustomers(realmId: string): Promise<QuickBooksCustomer[]> {
  const query = "SELECT Id, DisplayName, CompanyName, Active FROM Customer WHERE Active = true MAXRESULTS 200";
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
    },
  });
  const result = await parseJsonResponse(response) as { QueryResponse?: { Customer?: Array<Record<string, unknown>> } };
  if (!response.ok) {
    await throwQuickBooksApiError(connection, response, result);
  }
  const customers = result.QueryResponse?.Customer || [];
  return customers.map((c) => ({
    Id: String(c.Id || ""),
    DisplayName: String(c.DisplayName || ""),
    CompanyName: String(c.CompanyName || ""),
    Active: Boolean(c.Active),
  }));
}

export async function getQuickBooksCustomer(realmId: string, customerId: string): Promise<QuickBooksCustomerDetail> {
  const result = await quickBooksApiRequest<{ Customer: QuickBooksCustomerDetail }>({
    method: "GET",
    path: `/v3/company/${realmId}/customer/${encodeURIComponent(customerId)}?minorversion=75`,
  });

  return result.Customer;
}

export async function updateQuickBooksCustomerBillingAddress(
  realmId: string,
  customerId: string,
  billingAddress: QuickBooksBillingAddress
) {
  const customer = await getQuickBooksCustomer(realmId, customerId);
  if (!customer.SyncToken) {
    throw new Error("QuickBooks customer sync token is missing");
  }

  const payload = {
    sparse: true,
    Id: customerId,
    SyncToken: String(customer.SyncToken),
    BillAddr: {
      Line1: billingAddress.line1,
      Line2: billingAddress.line2,
      City: billingAddress.city,
      CountrySubDivisionCode: billingAddress.countrySubDivisionCode,
      PostalCode: billingAddress.postalCode,
      Country: billingAddress.country,
    },
  };

  const result = await quickBooksApiRequest<{ Customer: QuickBooksCustomerDetail }>({
    method: "POST",
    path: `/v3/company/${realmId}/customer?operation=update&minorversion=75`,
    body: payload,
  });

  return result.Customer;
}

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
  const result = await parseJsonResponse(response) as { QueryResponse?: { Item?: Array<Record<string, unknown>> } };
  if (!response.ok) {
    await throwQuickBooksApiError(connection, response, result);
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

async function findQuickBooksTermByName(realmId: string, termName: string): Promise<{ Id: string; Name: string } | null> {
  const cacheKey = `${realmId}:${slugifyTermName(termName)}`;
  if (termCache[cacheKey]) {
    return termCache[cacheKey];
  }

  const query = "SELECT Id, Name FROM Term MAXRESULTS 100";
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
    },
  });
  const result = (await parseJsonResponse(response)) as {
    QueryResponse?: { Term?: Array<Record<string, unknown>> };
  };
  if (!response.ok) {
    await throwQuickBooksApiError(connection, response, result);
  }

  const terms = result.QueryResponse?.Term || [];
  const targetSlug = slugifyTermName(termName);
  const match = terms.find((term) => slugifyTermName(String(term.Name || "")) === targetSlug);

  if (!match?.Id) {
    return null;
  }

  const termData = {
    Id: String(match.Id),
    Name: String(match.Name || termName),
  };
  termCache[cacheKey] = termData;
  return termData;
}

export async function findQuickBooksItemByName(realmId: string, itemName: string): Promise<QuickBooksItem | null> {
  const items = await getQuickBooksItems(realmId);
  const match = items.find((i) => i.Name === itemName);
  if (!match) {
    await persistApiError({
      route: "lib/quickbooks",
      method: "findItem",
      statusCode: 404,
      error: `QuickBooks product/service name mismatch: "${itemName}" not found in QBO. This will break automated maintenance invoices.`,
      metadata: { itemName, realmId },
    });
    return null;
  }
  return match;
}

export async function findQuickBooksInvoiceByDocNumber(
  realmId: string,
  docNumber: string,
  customerId?: string
): Promise<Record<string, unknown> | null> {
  const safeDocNumber = escapeQuickBooksQueryValue(docNumber);
  const query = `SELECT * FROM Invoice WHERE DocNumber = '${safeDocNumber}' MAXRESULTS 5`;
  const connection = await getFreshQuickBooksConnection();
  const url = `${getApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&include=allowonlinelink&minorversion=75`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
    },
  });
  const result = await parseJsonResponse(response) as { QueryResponse?: { Invoice?: Array<Record<string, unknown>> } };
  if (!response.ok) {
    await throwQuickBooksApiError(connection, response, result);
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
    await throwQuickBooksApiError(connection, response, {});
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

  // Prefer the hosted customer-facing payment page URL.
  const paymentUrl =
    (typeof invoice.OnlineInvoiceLink === "string" && invoice.OnlineInvoiceLink) ||
    (typeof invoice.InvoiceLink === "string" && invoice.InvoiceLink) ||
    (typeof invoice.InvoiceLinkUrl === "string" && invoice.InvoiceLinkUrl) ||
    null;

  const qboDocNumber = invoice.DocNumber ? String(invoice.DocNumber) : null;

  if (!qboDocNumber) {
    console.warn(`[QuickBooks] Invoice ${invoice.Id} is missing DocNumber in QBO response.`);
  }
  if (!paymentUrl && !isPaid) {
    console.warn(`[QuickBooks] Unpaid invoice ${invoice.Id} is missing OnlineInvoiceLink in QBO response.`);
  }

  const invoiceDate = typeof invoice.TxnDate === "string" && invoice.TxnDate
    ? invoice.TxnDate.slice(0, 10)
    : null;

  const dueDate = typeof invoice.DueDate === "string" && invoice.DueDate
    ? invoice.DueDate.slice(0, 10)
    : null;

  return {
    qboInvoiceId: String(invoice.Id || ""),
    qboDocNumber,
    qboSyncStatus: isPaid ? "paid" : "sent",
    amountPaid,
    paidAt: isPaid
      ? String((invoice.MetaData as { LastUpdatedTime?: string } | undefined)?.LastUpdatedTime || new Date().toISOString())
      : null,
    paymentUrl,
    invoiceDate,
    dueDate,
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

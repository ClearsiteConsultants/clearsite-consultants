'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Link2, PlusCircle } from "lucide-react";
import Header from "@/components/Header";
import {
  currencyDigitsToNumber,
  formatCurrencyFromDigits,
  sanitizeCurrencyDigits,
} from "@/lib/utils";

interface Client {
  id: string;
  company_name: string;
}

interface QboCustomer {
  Id: string;
  DisplayName: string;
  CompanyName: string;
}

interface QboItem {
  Id: string;
  Name: string;
  UnitPrice: number;
  Taxable: boolean;
  Type: string;
}

type FormMode = "qbo-create" | "manual-link";
type ManualLinkMode = "existing-client" | "new-client";
const MAX_AMOUNT_DUE = 10_000;
const MAX_AMOUNT_DUE_DIGITS = MAX_AMOUNT_DUE * 100;
const MAX_AMOUNT_DUE_MESSAGE = "Max Limit is $10,000.00";

export default function AdminInvoices() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [formMode, setFormMode] = useState<FormMode>("qbo-create");
  const [qboItems, setQboItems] = useState<QboItem[]>([]);
  const [qboItemsLoading, setQboItemsLoading] = useState(false);
  const [qboCustomers, setQboCustomers] = useState<QboCustomer[]>([]);
  const [qboCustomersLoading, setQboCustomersLoading] = useState(false);

  // QuickBooks-first mode fields
  const [selectedClientId, setSelectedClientId] = useState("");
  const [amountDueDigits, setAmountDueDigits] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  // Manual-link mode fields
  const [manualLinkMode, setManualLinkMode] = useState<ManualLinkMode>("existing-client");
  const [mlClientId, setMlClientId] = useState("");
  const [mlQboCustomerId, setMlQboCustomerId] = useState("");
  const [mlQboInvoiceId, setMlQboInvoiceId] = useState("");
  const [mlErrors, setMlErrors] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [qboLoading, setQboLoading] = useState(true);
  const [qboStatus, setQboStatus] = useState<{
    connected: boolean;
    realmId?: string;
    tokenExpiresAt?: string;
  }>({ connected: false });
  const [message, setMessage] = useState({ type: "", text: "" });

  const amountDueDisplay = amountDueDigits ? `$${formatCurrencyFromDigits(amountDueDigits)}` : "";
  const qboAmountDue = currencyDigitsToNumber(amountDueDigits);
  const qboAmountDueExceedsMax = parseInt(amountDueDigits || "0", 10) > MAX_AMOUNT_DUE_DIGITS;

  useEffect(() => {
    const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && userType !== "admin") {
      router.push("/portal");
    }
  }, [status, router, session]);

  useEffect(() => {
    loadClients();
    loadQuickBooksStatus();
  }, []);

  useEffect(() => {
    if (qboStatus.connected) {
      loadQboCustomers();
    }
  }, [qboStatus.connected]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qbo = params.get("qbo");
    const reason = params.get("reason");
    if (qbo === "connected") {
      setMessage({ type: "success", text: "QuickBooks connected successfully." });
      loadQuickBooksStatus();
    }
    if (qbo === "error") {
      setMessage({ type: "error", text: reason ? `QuickBooks connection failed: ${reason}` : "QuickBooks connection failed." });
    }
  }, []);

  // Load QBO items whenever QBO becomes connected and the create form is active.
  useEffect(() => {
    if (qboStatus.connected && formMode === "qbo-create") {
      loadQboItems();
    }
  }, [qboStatus.connected, formMode]);

  const loadClients = async () => {
    try {
      const res = await fetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to load clients", error);
    }
  };

  const loadQuickBooksStatus = async () => {
    try {
      setQboLoading(true);
      const res = await fetch("/api/integrations/quickbooks/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setQboStatus(data);
    } catch (error) {
      console.error("Failed to load QuickBooks status", error);
    } finally {
      setQboLoading(false);
    }
  };

  const loadQboItems = async () => {
    try {
      setQboItemsLoading(true);
      const res = await fetch("/api/invoices?action=qbo-items", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setQboItems(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load QBO items", error);
    } finally {
      setQboItemsLoading(false);
    }
  };

  const loadQboCustomers = async () => {
    try {
      setQboCustomersLoading(true);
      const res = await fetch("/api/invoices?action=qbo-customers", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setQboCustomers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load QBO customers", error);
    } finally {
      setQboCustomersLoading(false);
    }
  };

  const handleConnectQuickBooks = () => {
    window.location.href = "/api/integrations/quickbooks/connect";
  };

  const resetQboForm = () => {
    setSelectedClientId("");
    setAmountDueDigits("");
    setInvoiceDate("");
    setDueDate("");
    setSelectedItemId("");
  };

  const resetManualLinkForm = () => {
    setManualLinkMode("existing-client");
    setMlClientId("");
    setMlQboCustomerId("");
    setMlQboInvoiceId("");
    setMlErrors({});
  };

  const handleManualLinkModeChange = (nextMode: ManualLinkMode) => {
    setManualLinkMode(nextMode);
    setMlClientId("");
    setMlQboCustomerId("");
    setMlQboInvoiceId("");
    setMlErrors({});
  };

  const handleQboAmountDueChange = (value: string) => {
    setAmountDueDigits(sanitizeCurrencyDigits(value));
  };

  // When a QBO item is selected, auto-fill amount from the item's unit price.
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    if (itemId) {
      const item = qboItems.find((i) => i.Id === itemId);
      if (item && item.UnitPrice > 0) {
        // Convert to digits format (cents as integer string).
        const digits = String(Math.round(item.UnitPrice * 100));
        setAmountDueDigits(digits);
      }
    }
  };

  const handleQboSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (qboAmountDueExceedsMax) {
      setMessage({ type: "error", text: MAX_AMOUNT_DUE_MESSAGE });
      return;
    }

    if (!selectedClientId || qboAmountDue <= 0 || !dueDate) {
      setMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          amount_due: qboAmountDue,
          invoice_date: invoiceDate || undefined,
          due_date: dueDate,
          qbo_item_id: selectedItemId || undefined,
          sync_to_qbo: true,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create invoice");

      if (payload?.sync_error) {
        setMessage({ type: "error", text: `Invoice created, but QuickBooks sync failed: ${payload.sync_error}` });
      } else if (payload?.qbo_invoice_id) {
        const docLabel = payload.qbo_doc_number ? ` (${payload.qbo_doc_number})` : "";
        setMessage({ type: "success", text: `Invoice created and synced to QuickBooks${docLabel}.` });
      } else {
        setMessage({ type: "success", text: "Invoice created successfully." });
      }

      resetQboForm();
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create invoice",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const validateManualLink = () => {
    const errors: Record<string, string> = {};
    if (manualLinkMode === "existing-client") {
      if (!mlClientId) errors.client = "Client is required.";
    } else if (!mlQboCustomerId) {
      errors.customer = "QuickBooks customer is required.";
    }
    if (!mlQboInvoiceId || !mlQboInvoiceId.trim()) errors.invoiceId = "QuickBooks Invoice ID is required.";
    return errors;
  };

  const handleManualLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    const errors = validateManualLink();
    if (Object.keys(errors).length > 0) {
      setMlErrors(errors);
      return;
    }
    setMlErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual-link",
          manual_link_mode: manualLinkMode,
          client_id: manualLinkMode === "existing-client" ? mlClientId : undefined,
          qbo_customer_id: manualLinkMode === "new-client" ? mlQboCustomerId : undefined,
          qbo_invoice_id: mlQboInvoiceId.trim(),
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          setMlErrors({ invoiceId: payload.error });
          return;
        }
        if (res.status === 409) {
          setMlErrors({ invoiceId: payload.error });
          return;
        }
        throw new Error(payload?.error || "Could not link invoice. Please try again.");
      }

      const docLabel = payload.qbo_doc_number ? ` #${payload.qbo_doc_number}` : "";
      setMessage({ type: "success", text: `QuickBooks invoice${docLabel} linked to client account.` });
      resetManualLinkForm();
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not link invoice. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-tech">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-5xl text-gray-900 mb-8">Create Client Invoice</h1>

        {/* QuickBooks Connection Status */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">QuickBooks Connection</h2>
              {qboLoading ? (
                <p className="text-sm text-gray-600">Checking QuickBooks status...</p>
              ) : qboStatus.connected ? (
                <div className="text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Connected to realm {qboStatus.realmId}
                </div>
              ) : (
                <p className="text-sm text-amber-700">Not connected. Invoices cannot auto-sync until QuickBooks is connected.</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleConnectQuickBooks}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-gray-700 hover:bg-gray-50"
            >
              <Link2 className="w-4 h-4" />
              {qboStatus.connected ? "Reconnect QuickBooks" : "Connect QuickBooks"}
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => { setFormMode("qbo-create"); setMessage({ type: "", text: "" }); }}
            className={`px-5 py-2 rounded-xl text-sm font-semibold uppercase tracking-[0.12em] transition border ${
              formMode === "qbo-create"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Create in QuickBooks
          </button>
          <button
            type="button"
            onClick={() => { setFormMode("manual-link"); setMessage({ type: "", text: "" }); }}
            className={`px-5 py-2 rounded-xl text-sm font-semibold uppercase tracking-[0.12em] transition border ${
              formMode === "manual-link"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Link Existing Invoice
          </button>
        </div>

        {/* Global message */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ── QuickBooks-first form ── */}
        {formMode === "qbo-create" && (
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600 mb-6">
              Enter the client, amount, and due date. QuickBooks will auto-generate the invoice number, and the PDF will be stored for the client portal.
            </p>
            <form onSubmit={handleQboSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product / Service <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={qboItemsLoading || !qboStatus.connected}
                >
                  <option value="">{qboItemsLoading ? "Loading items..." : qboStatus.connected ? "Select a product or service" : "Connect QuickBooks to load items"}</option>
                  {qboItems.map((item) => (
                    <option key={item.Id} value={item.Id}>
                      {item.Name}{item.UnitPrice > 0 ? ` — $${item.UnitPrice.toFixed(2)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Due</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountDueDisplay}
                  onChange={(e) => handleQboAmountDueChange(e.target.value)}
                  placeholder="$0.00"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${qboAmountDueExceedsMax ? "border-red-400" : "border-gray-300"}`}
                  required
                />
                {qboAmountDueExceedsMax && <p className="mt-1 text-sm text-red-600">{MAX_AMOUNT_DUE_MESSAGE}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-[0.18em] text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                {submitting ? "Creating..." : "Create Invoice in QuickBooks"}
              </button>
            </form>
          </div>
        )}

        {/* ── Manual-link form ── */}
        {formMode === "manual-link" && (
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600 mb-6">
              Link an existing QuickBooks invoice that was created directly in QuickBooks. Use existing client mode for a current Clearsite client, or new client mode to pull from active QuickBooks customers and create a local client record if needed.
            </p>
            <form onSubmit={handleManualLinkSubmit} className="space-y-6" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleManualLinkModeChange("existing-client")}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      manualLinkMode === "existing-client"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Existing Client
                  </button>
                  <button
                    type="button"
                    onClick={() => handleManualLinkModeChange("new-client")}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      manualLinkMode === "new-client"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    New Client
                  </button>
                </div>
              </div>

              {manualLinkMode === "existing-client" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                  <select
                    value={mlClientId}
                    onChange={(e) => setMlClientId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.client ? "border-red-400" : "border-gray-300"}`}
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company_name}
                      </option>
                    ))}
                  </select>
                  {mlErrors.client && <p className="mt-1 text-sm text-red-600">{mlErrors.client}</p>}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">QuickBooks Customer</label>
                  <select
                    value={mlQboCustomerId}
                    onChange={(e) => setMlQboCustomerId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.customer ? "border-red-400" : "border-gray-300"}`}
                    disabled={qboCustomersLoading || !qboStatus.connected}
                  >
                    <option value="">
                      {qboCustomersLoading
                        ? "Loading customers..."
                        : !qboStatus.connected
                        ? "Connect QuickBooks to load customers"
                        : "Select a QuickBooks customer"}
                    </option>
                    {qboCustomers.map((customer) => (
                      <option key={customer.Id} value={customer.Id}>
                        {customer.DisplayName}
                        {customer.CompanyName && customer.CompanyName !== customer.DisplayName ? ` (${customer.CompanyName})` : ""}
                      </option>
                    ))}
                  </select>
                  {mlErrors.customer && <p className="mt-1 text-sm text-red-600">{mlErrors.customer}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    New client mode reuses an existing local record when the QuickBooks customer or email already matches, and creates a local client record only when needed.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QuickBooks Invoice ID</label>
                <input
                  type="text"
                  value={mlQboInvoiceId}
                  onChange={(e) => setMlQboInvoiceId(e.target.value)}
                  placeholder="e.g. 215"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.invoiceId ? "border-red-400" : "border-gray-300"}`}
                />
                {mlErrors.invoiceId && <p className="mt-1 text-sm text-red-600">{mlErrors.invoiceId}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Find the QuickBooks invoice ID in the invoice URL or on the QuickBooks invoice details page.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-[0.18em] text-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  {submitting ? "Linking..." : "Link Invoice"}
                </button>
                <button
                  type="button"
                  onClick={resetManualLinkForm}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-semibold uppercase tracking-[0.18em] text-gray-700 hover:bg-gray-50 transition"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Link2, PlusCircle } from "lucide-react";
import { isValidQboPaymentUrl } from "@/lib/utils";

interface Client {
  id: string;
  company_name: string;
}

type FormMode = "qbo-create" | "manual-link";

export default function AdminInvoices() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [formMode, setFormMode] = useState<FormMode>("qbo-create");

  // QuickBooks-first mode fields
  const [selectedClientId, setSelectedClientId] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Manual-link mode fields
  const [mlClientId, setMlClientId] = useState("");
  const [mlPaymentUrl, setMlPaymentUrl] = useState("");
  const [mlAmountDue, setMlAmountDue] = useState("");
  const [mlDueDate, setMlDueDate] = useState("");
  const [mlInvoiceNumber, setMlInvoiceNumber] = useState("");
  const [mlQboInvoiceId, setMlQboInvoiceId] = useState("");
  const [mlNotes, setMlNotes] = useState("");
  const [mlErrors, setMlErrors] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [qboLoading, setQboLoading] = useState(true);
  const [qboStatus, setQboStatus] = useState<{
    connected: boolean;
    realmId?: string;
    tokenExpiresAt?: string;
  }>({ connected: false });
  const [message, setMessage] = useState({ type: "", text: "" });

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

  const handleConnectQuickBooks = () => {
    window.location.href = "/api/integrations/quickbooks/connect";
  };

  const resetQboForm = () => {
    setSelectedClientId("");
    setAmountDue("");
    setDueDate("");
  };

  const resetManualLinkForm = () => {
    setMlClientId("");
    setMlPaymentUrl("");
    setMlAmountDue("");
    setMlDueDate("");
    setMlInvoiceNumber("");
    setMlQboInvoiceId("");
    setMlNotes("");
    setMlErrors({});
  };

  const handleQboSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!selectedClientId || !amountDue || !dueDate) {
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
          amount_due: parseFloat(amountDue),
          due_date: dueDate,
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
    if (!mlClientId) errors.client = "Client is required.";
    if (!mlPaymentUrl) {
      errors.paymentUrl = "QuickBooks Payment Link is required.";
    } else if (!isValidQboPaymentUrl(mlPaymentUrl)) {
      errors.paymentUrl = "Enter a valid https:// QuickBooks payment link.";
    }
    if (!mlAmountDue || Number(mlAmountDue) <= 0) errors.amountDue = "Amount Due must be greater than 0.";
    if (!mlDueDate) {
      errors.dueDate = "Due Date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(mlDueDate) < today) errors.dueDate = "Due Date must be today or later.";
    }
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
          client_id: mlClientId,
          qbo_payment_url: mlPaymentUrl,
          amount_due: parseFloat(mlAmountDue),
          due_date: mlDueDate,
          invoice_number: mlInvoiceNumber || undefined,
          qbo_invoice_id: mlQboInvoiceId || undefined,
          notes: mlNotes || undefined,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setMlErrors({ paymentUrl: payload.error });
          return;
        }
        throw new Error(payload?.error || "Could not save linked invoice. Please try again.");
      }

      setMessage({ type: "success", text: "Linked QuickBooks invoice saved to client account." });
      resetManualLinkForm();
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save linked invoice. Please try again.",
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Due</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountDue}
                  onChange={(e) => setAmountDue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
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
              Link an existing QuickBooks invoice to a client account. This lets the client see and pay from their portal without creating a new QuickBooks invoice.
            </p>
            <form onSubmit={handleManualLinkSubmit} className="space-y-6" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <select
                  value={mlClientId}
                  onChange={(e) => setMlClientId(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.client ? "border-red-400" : "border-gray-300"}`}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.company_name}</option>
                  ))}
                </select>
                {mlErrors.client && <p className="mt-1 text-sm text-red-600">{mlErrors.client}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QuickBooks Payment Link</label>
                <input
                  type="url"
                  value={mlPaymentUrl}
                  onChange={(e) => setMlPaymentUrl(e.target.value)}
                  placeholder="https://quickbooks.intuit.com/..."
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.paymentUrl ? "border-red-400" : "border-gray-300"}`}
                />
                {mlErrors.paymentUrl && <p className="mt-1 text-sm text-red-600">{mlErrors.paymentUrl}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Due</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={mlAmountDue}
                  onChange={(e) => setMlAmountDue(e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.amountDue ? "border-red-400" : "border-gray-300"}`}
                />
                {mlErrors.amountDue && <p className="mt-1 text-sm text-red-600">{mlErrors.amountDue}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={mlDueDate}
                  onChange={(e) => setMlDueDate(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 ${mlErrors.dueDate ? "border-red-400" : "border-gray-300"}`}
                />
                {mlErrors.dueDate && <p className="mt-1 text-sm text-red-600">{mlErrors.dueDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={mlInvoiceNumber}
                  onChange={(e) => setMlInvoiceNumber(e.target.value)}
                  placeholder="e.g. 1042"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QuickBooks Invoice ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={mlQboInvoiceId}
                  onChange={(e) => setMlQboInvoiceId(e.target.value)}
                  placeholder="e.g. 123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Internal Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={mlNotes}
                  onChange={(e) => setMlNotes(e.target.value)}
                  rows={3}
                  placeholder="Admin-only context about this invoice..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-[0.18em] text-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  {submitting ? "Saving..." : "Save Linked Invoice"}
                </button>
                <button
                  type="button"
                  onClick={resetManualLinkForm}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-semibold uppercase tracking-[0.18em] text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


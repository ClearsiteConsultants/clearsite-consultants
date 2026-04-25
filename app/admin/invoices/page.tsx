'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Upload } from "lucide-react";

interface Client {
  id: string;
  company_name: string;
}

export default function AdminInvoices() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [qboPaymentUrl, setQboPaymentUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!selectedClientId || !invoiceNumber || !amountDue || !dueDate) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setUploading(true);

    try {
      let fileUrl = null;

      if (pdfFile) {
        const formData = new FormData();
        formData.append("file", pdfFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file");

        const uploadData = await uploadRes.json();
        fileUrl = uploadData.url;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          invoice_number: invoiceNumber,
          amount_due: parseFloat(amountDue),
          due_date: dueDate,
          file_url: fileUrl,
          qbo_payment_url: qboPaymentUrl || null,
          sync_to_qbo: true,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to create invoice");

      if (payload?.sync_error) {
        setMessage({ type: "error", text: `Invoice created, but QuickBooks sync failed: ${payload.sync_error}` });
      } else if (payload?.qbo_invoice_id) {
        setMessage({ type: "success", text: "Invoice uploaded and synced to QuickBooks." });
      } else {
        setMessage({ type: "success", text: "Invoice uploaded successfully!" });
      }

      setSelectedClientId("");
      setInvoiceNumber("");
      setAmountDue("");
      setDueDate("");
      setQboPaymentUrl("");
      setPdfFile(null);
      (document.getElementById("pdf-file") as HTMLInputElement).value = "";
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create invoice",
      });
    } finally {
      setUploading(false);
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
        <h1 className="font-display text-5xl text-gray-900 mb-8">Upload Client Invoice</h1>

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

        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2024-001"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Due
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QuickBooks Payment URL
              </label>
              <input
                type="url"
                value={qboPaymentUrl}
                onChange={(e) => setQboPaymentUrl(e.target.value)}
                placeholder="https://quickbooks.intuit.com/..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice PDF
              </label>
              <input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {pdfFile && (
                <span className="text-sm text-gray-600 mt-2">{pdfFile.name}</span>
              )}
            </div>

            {message.text && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-[0.18em] text-sm"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload Invoice"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

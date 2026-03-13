'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Upload } from "lucide-react";

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
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await fetch("/api/invoices?action=admin-list");
      const data = await res.json();
      setClients(data);
    } catch (error) {
      console.error("Failed to load clients", error);
    }
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

      // Upload PDF if provided
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

      // Create invoice
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
        }),
      });

      if (!res.ok) throw new Error("Failed to create invoice");

      setMessage({ type: "success", text: "Invoice uploaded successfully!" });

      // Reset form
      setSelectedClientId("");
      setInvoiceNumber("");
      setAmountDue("");
      setDueDate("");
      setQboPaymentUrl("");
      setPdfFile(null);
      (document.getElementById("pdf-file") as HTMLInputElement).value = "";
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Upload Client Invoice</h1>

        <div className="bg-white p-8 rounded-lg border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
              className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
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

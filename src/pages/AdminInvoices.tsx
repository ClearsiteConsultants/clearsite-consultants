import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";

interface Client {
  id: string;
  company_name: string;
}

const AdminInvoices = () => {
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
    loadClients();
  }, []);

  const loadClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, company_name")
      .order("company_name");

    if (data) setClients(data);
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

      // Upload PDF to Supabase Storage if provided
      if (pdfFile) {
        const fileName = `${selectedClientId}/${invoiceNumber}-${Date.now()}.pdf`;
        const { data, error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(fileName, pdfFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("invoices")
          .getPublicUrl(fileName);

        fileUrl = urlData.publicUrl;
      }

      // Insert invoice record
      const { error: insertError } = await supabase.from("invoices").insert({
        client_id: selectedClientId,
        invoice_number: invoiceNumber,
        amount_due: parseFloat(amountDue),
        due_date: dueDate,
        status: "Unpaid",
        file_url: fileUrl,
        qbo_payment_url: qboPaymentUrl || null,
      });

      if (insertError) throw insertError;

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
      setMessage({ type: "error", text: error.message || "Failed to upload invoice" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tech">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl text-gray-900 mb-8">Upload Client Invoice</h1>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection */}
            <div>
              <Label htmlFor="client">Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Number */}
            <div>
              <Label htmlFor="invoice-number">Invoice Number *</Label>
              <Input
                id="invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2024-001"
                required
              />
            </div>

            {/* Amount Due */}
            <div>
              <Label htmlFor="amount">Amount Due *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            {/* Due Date */}
            <div>
              <Label htmlFor="due-date">Due Date *</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            {/* QuickBooks Payment URL */}
            <div>
              <Label htmlFor="qbo-url">QuickBooks Payment URL</Label>
              <Input
                id="qbo-url"
                type="url"
                value={qboPaymentUrl}
                onChange={(e) => setQboPaymentUrl(e.target.value)}
                placeholder="https://quickbooks.intuit.com/..."
              />
            </div>

            {/* PDF Upload */}
            <div>
              <Label htmlFor="pdf-file">Invoice PDF</Label>
              <div className="mt-2 flex items-center gap-4">
                <Input
                  id="pdf-file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {pdfFile && (
                  <span className="text-sm text-gray-600">{pdfFile.name}</span>
                )}
              </div>
            </div>

            {/* Message */}
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

            {/* Submit */}
            <Button type="submit" disabled={uploading} className="w-full">
              {uploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Invoice
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AdminInvoices;

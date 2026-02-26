import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, FileText, CreditCard } from "lucide-react";

interface Client {
  id: string;
  company_name: string;
  domain_name: string;
  plan: string;
  service_status: string;
  next_invoice_due: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: number;
  due_date: string;
  status: string;
  file_url: string | null;
  qbo_payment_url: string | null;
}

const Portal = () => {
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load client data
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("owner_user_id", user.id)
      .single();

    if (clientData) {
      setClient(clientData);

      // Load invoices
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: false });

      setInvoices(invoicesData || []);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const handlePlanChange = async (newPlan: string) => {
    if (!client) return;
    setUpdatingPlan(true);

    const { error } = await supabase
      .from("clients")
      .update({ plan: newPlan })
      .eq("id", client.id);

    if (!error) {
      // Log plan change in subscriptions table
      await supabase.from("subscriptions").insert({
        client_id: client.id,
        old_plan: client.plan,
        new_plan: newPlan,
        change_type: "upgrade",
      });

      setClient({ ...client, plan: newPlan });
    }

    setUpdatingPlan(false);
  };

  const handleCancelService = async () => {
    if (!client || !confirm("Are you sure you want to cancel your service?")) return;

    const { error } = await supabase
      .from("clients")
      .update({ service_status: "Canceled" })
      .eq("id", client.id);

    if (!error) {
      setClient({ ...client, service_status: "Canceled" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-tech flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-tech flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Client profile not found. Please contact support.</p>
          <Button onClick={handleLogout} className="mt-4">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tech">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl text-gray-900 mb-2">{client.company_name}</h1>
            <p className="text-gray-600">{client.domain_name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>

        {/* Account Info */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Plan</h3>
            <p className="text-2xl font-display text-gray-900">{client.plan}</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Service Status</h3>
            <p className={`text-2xl font-display ${client.service_status === "Active" ? "text-emerald-600" : "text-red-600"}`}>
              {client.service_status}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Next Invoice Due</h3>
            <p className="text-2xl font-display text-gray-900">
              {client.next_invoice_due || "N/A"}
            </p>
          </Card>
        </div>

        {/* Plan Management */}
        {client.service_status === "Active" && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-display text-gray-900 mb-4">Manage Plan</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Change Plan</label>
                <Select value={client.plan} onValueChange={handlePlanChange} disabled={updatingPlan}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Starter</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="destructive" onClick={handleCancelService} className="mt-6">
                Cancel Service
              </Button>
            </div>
          </Card>
        )}

        {/* Invoices */}
        <Card className="p-6">
          <h2 className="text-xl font-display text-gray-900 mb-4">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-gray-600">No invoices yet.</p>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-4">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-semibold text-gray-900">Invoice #{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-600">
                        Due: {new Date(invoice.due_date).toLocaleDateString()} • ${invoice.amount_due.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invoice.status === "Paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {invoice.status}
                    </span>
                    {invoice.file_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={invoice.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View PDF
                        </a>
                      </Button>
                    )}
                    {invoice.status !== "Paid" && invoice.qbo_payment_url && (
                      <Button size="sm" asChild>
                        <a href={invoice.qbo_payment_url} target="_blank" rel="noopener noreferrer">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pay Now
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Portal;

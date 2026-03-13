'use client';

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function Portal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    // In a real app, fetch from API
    // For now, mock data
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/" });
  };

  const handlePlanChange = async (newPlan: string) => {
    if (!client) return;
    setUpdatingPlan(true);

    try {
      const res = await fetch("/api/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-plan",
          client_id: client.id,
          new_plan: newPlan,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setClient({ ...client, plan: newPlan });
      }
    } catch (error) {
      console.error("Failed to update plan", error);
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleCancelService = async () => {
    if (!client || !confirm("Are you sure you want to cancel your service?")) return;

    try {
      const res = await fetch("/api/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel-service",
          client_id: client.id,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setClient({ ...client, service_status: "Canceled" });
      }
    } catch (error) {
      console.error("Failed to cancel service", error);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Client Portal</h1>
            <p className="text-gray-600">Welcome back, {session.user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Account Info */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Plan</h3>
            <p className="text-2xl font-bold text-gray-900">Starter</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Service Status</h3>
            <p className="text-2xl font-bold text-emerald-600">Active</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Next Invoice Due</h3>
            <p className="text-2xl font-bold text-gray-900">N/A</p>
          </div>
        </div>

        {/* Plan Management */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Manage Plan</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Change Plan</label>
              <select
                onChange={(e) => handlePlanChange(e.target.value)}
                disabled={updatingPlan}
                className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Starter">Starter</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <button
              onClick={handleCancelService}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition mt-6"
            >
              Cancel Service
            </button>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Invoices</h2>
          <p className="text-gray-600">No invoices yet.</p>
        </div>
      </div>
    </div>
  );
}

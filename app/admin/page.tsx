'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Edit2, Settings, Upload } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientUser {
  id: string;
  email: string;
  company_name: string;
  plan: string;
  service_status: string;
  next_invoice_due: string | null;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface EditingClient {
  id: string;
  plan: string;
  service_status: string;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<EditingClient | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
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
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/clients", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to load clients", error);
      setMessage({ type: "error", text: "Failed to load clients" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClient = (client: ClientUser) => {
    setEditingClient({
      id: client.id,
      plan: client.plan,
      service_status: client.service_status,
    });
    setShowEditModal(true);
  };

  const handleSaveClient = async () => {
    if (!editingClient) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingClient),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Client updated successfully" });
        setShowEditModal(false);
        loadClients();
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error || "Failed to update client" });
      }
    } catch (error) {
      console.error("Failed to save client", error);
      setMessage({ type: "error", text: "Failed to save client" });
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
      </div>

      {/* Messages */}
      {message.text && (
        <div
          className={`max-w-7xl mx-auto px-4 py-4 mt-4 rounded-md ${
            message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Client Accounts</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Company</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Contact</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Plan</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Next Invoice Due</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No clients found
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{client.company_name}</td>
                        <td className="px-6 py-4 text-sm">{client.email}</td>
                        <td className="px-6 py-4 text-sm">{[client.first_name, client.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-6 py-4 text-sm">{client.plan}</td>
                        <td className="px-6 py-4 text-sm">{formatDate(client.next_invoice_due)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 text-sm rounded-full ${
                              client.service_status === "Active"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {client.service_status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClient(client)}
                            className="flex items-center gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Invoice Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">Upload and manage client invoices.</p>
              <a href="/admin/invoices" className="text-blue-600 hover:underline font-medium">
                Open Invoice Management
              </a>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Setting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">Review and update your account settings.</p>
              <a href="/account-settings" className="text-blue-600 hover:underline font-medium">
                Open Account Setting
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingClient && (
        <div
          className="fixed inset-0 bg-gray-500/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowEditModal(false)}
        >
          <div className="bg-white rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Edit Client</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan</label>
                <select
                  value={editingClient.plan}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, plan: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Starter">Starter</option>
                  <option value="Feature-Rich">Feature-Rich</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Service Status</label>
                <select
                  value={editingClient.service_status}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, service_status: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Canceled">Canceled</option>
                </select>
              </div>

            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveClient} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
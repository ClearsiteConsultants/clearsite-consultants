'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Edit2, Settings, Upload, Bug, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUICKBOOKS_CONNECT_PATH = "/api/integrations/quickbooks/connect";
const QUICKBOOKS_API_FAILED_MESSAGE = "QuickBooks API request failed";

function isQuickBooksApiFailureMessage(message: unknown) {
  return typeof message === "string" && message.toLowerCase().includes(QUICKBOOKS_API_FAILED_MESSAGE.toLowerCase());
}

interface ClientUser {
  id: string;
  email: string;
  company_name: string;
  plan: string | null;
  service_status: string | null;
  client_status: string;
  maintenance_fee_frequency: string;
  next_invoice_due: string | null;
  service_start_date: string | null;
  first_name: string;
  last_name: string;
  phone?: string;
  action_needed?: boolean;
}

interface EditingClient {
  id: string;
  plan: string | null;
  service_status: string | null;
  client_status: string;
  maintenance_fee_frequency: string;
  service_start_date: string | null;
}

interface ActionNeededIssue {
  invoiceId: string;
  qboDocNumber: string | null;
  qboInvoiceId: string | null;
  qboSyncStatus: string | null;
  dueDate: string | null;
  invoiceDate: string | null;
  amountTotal: number | null;
  amountPaid: number | null;
  updatedAt: string | null;
  errorMessage?: string | null;
}

function formatCalendarDate(value: string | null | undefined) {
  if (!value) return "N/A";

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

function formatTimestampDate(value: string | null | undefined) {
  if (!value) return "N/A";

  const date = new Date(value);

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
  const [showActionNeededModal, setShowActionNeededModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionNeededClientName, setActionNeededClientName] = useState("");
  const [actionNeededLoading, setActionNeededLoading] = useState(false);
  const [actionNeededError, setActionNeededError] = useState("");
  const [actionNeededIssues, setActionNeededIssues] = useState<ActionNeededIssue[]>([]);
  const [manualSyncLoading, setManualSyncLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string; details?: string[] }>({ type: "", text: "" });

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
      client_status: client.client_status || "Active",
      maintenance_fee_frequency: client.maintenance_fee_frequency || "Monthly",
      service_start_date: client.service_start_date ? client.service_start_date.slice(0, 10) : null,
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

  const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== "number") return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleOpenActionNeeded = async (client: ClientUser) => {
    setShowActionNeededModal(true);
    setActionNeededClientName(client.company_name);
    setActionNeededIssues([]);
    setActionNeededError("");
    setActionNeededLoading(true);

    try {
      const res = await fetch(`/api/admin/clients/${client.id}/action-needed`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to load action-needed issues");
      }

      const payload = await res.json() as { issues?: ActionNeededIssue[] };
      setActionNeededIssues(Array.isArray(payload.issues) ? payload.issues : []);
    } catch (error) {
      console.error("Failed to load action-needed issues", error);
      setActionNeededError(error instanceof Error ? error.message : "Failed to load action-needed issues");
    } finally {
      setActionNeededLoading(false);
    }
  };

  const handleManualSync = async () => {
    setManualSyncLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json().catch(() => null) as {
        error?: string;
        reconnectRequired?: boolean;
        invoiceSync?: {
          clientsProcessed?: number;
          syncedInvoices?: number;
          failedInvoices?: number;
        };
        qboData?: {
          productsServicesCount?: number | null;
          customersCount?: number | null;
        };
        developerLogs?: {
          newLogs?: number;
          newMissingPaymentUrlLogs?: number;
        };
        errors?: Array<{ scope?: string; message?: string }>;
      } | null;

      if (payload?.reconnectRequired) {
        router.push(QUICKBOOKS_CONNECT_PATH);
        return;
      }

      const hasQuickBooksApiFailure = (payload?.errors ?? []).some((e) => isQuickBooksApiFailureMessage(e?.message));
      if (hasQuickBooksApiFailure || isQuickBooksApiFailureMessage(payload?.error)) {
        router.push(QUICKBOOKS_CONNECT_PATH);
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Manual sync failed");
      }

      const clientsProcessed = payload?.invoiceSync?.clientsProcessed ?? 0;
      const syncedInvoices = payload?.invoiceSync?.syncedInvoices ?? 0;
      const failedInvoices = payload?.invoiceSync?.failedInvoices ?? 0;
      const itemsCount = payload?.qboData?.productsServicesCount ?? 0;
      const customersCount = payload?.qboData?.customersCount ?? 0;
      const newLogs = payload?.developerLogs?.newLogs ?? payload?.developerLogs?.newMissingPaymentUrlLogs ?? 0;
      const errorCount = Array.isArray(payload?.errors) ? payload?.errors.length : 0;

      const errorDetails = (payload?.errors ?? []).map(
        (e) => `[${e.scope ?? "unknown"}] ${e.message ?? "Unknown error"}`
      );

      setMessage({
        type: errorCount > 0 ? "error" : "success",
        text: `Manual sync completed: ${clientsProcessed} clients refreshed, ${syncedInvoices} invoices synced, ${failedInvoices} invoice sync failures, ${itemsCount} products/services, ${customersCount} customers, ${newLogs} errors logged.${
          errorCount > 0 ? ` ${errorCount} refresh operation${errorCount === 1 ? "" : "s"} returned errors:` : ""
        }`,
        details: errorCount > 0 ? errorDetails : undefined,
      });

      await loadClients();
    } catch (error) {
      console.error("Failed manual sync", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Manual sync failed",
      });
    } finally {
      setManualSyncLoading(false);
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
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <Button onClick={handleManualSync} disabled={manualSyncLoading} className="w-full md:w-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${manualSyncLoading ? "animate-spin" : ""}`} />
            {manualSyncLoading ? "Running Manual Sync..." : "Manual Sync"}
          </Button>
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
          <p>{message.text}</p>
          {message.details && message.details.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
              {message.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
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
                    <th className="px-6 py-3 text-left text-sm font-semibold">Client Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Plan</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Service Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Next Invoice Due</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Service Start Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No clients found
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{client.company_name}</span>
                            {client.action_needed && (
                              <button
                                type="button"
                                onClick={() => handleOpenActionNeeded(client)}
                                className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 hover:bg-amber-200"
                              >
                                Action needed
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">{client.email}</td>
                        <td className="px-6 py-4 text-sm">{[client.first_name, client.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 text-sm rounded-full ${
                              client.client_status === "Active"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {client.client_status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm ${!client.plan ? "text-center" : ""}`}>
                          {client.plan || "—"}
                        </td>
                        <td className="px-6 py-4">
                          {client.service_status ? (
                            <span
                              className={`px-3 py-1 text-sm rounded-full ${
                                client.service_status === "Active"
                                  ? "bg-green-100 text-green-800"
                                  : client.service_status === "Paused"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {client.service_status}
                            </span>
                          ) : (
                            <div className="text-sm text-center">—</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">{formatCalendarDate(client.next_invoice_due)}</td>
                        <td className="px-6 py-4 text-sm">{formatCalendarDate(client.service_start_date)}</td>
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
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">Review and update your account settings.</p>
              <a href="/account-settings" className="text-blue-600 hover:underline font-medium">
                Open Account Settings
              </a>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Developer Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">Review and manage persisted API error logs.</p>
              <a href="/admin/developer" className="text-blue-600 hover:underline font-medium">
                Open Developer Logs
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
                <label className="block text-sm font-medium mb-1">Client Status</label>
                <select
                  value={editingClient.client_status}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, client_status: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Plan</label>
                <select
                  value={editingClient.plan || ""}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, plan: e.target.value || null })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Not Enrolled</option>
                  <option value="Starter">Starter</option>
                  <option value="Feature-Rich">Feature-Rich</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Maintenance Fee Frequency</label>
                <select
                  value={editingClient.maintenance_fee_frequency}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, maintenance_fee_frequency: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Service Status</label>
                <select
                  value={editingClient.service_status || ""}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, service_status: e.target.value || null })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Not Enrolled</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Canceled">Canceled</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Canceling this plan will remove the client from an active plan. Are you sure you want to proceed?"
                    );
                    if (confirmed) {
                      setEditingClient({ ...editingClient, plan: null });
                    }
                  }}
                  className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Cancel Plan
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Service Start Date</label>
                <input
                  type="date"
                  value={editingClient.service_start_date || ""}
                  onChange={(e) =>
                    setEditingClient({ ...editingClient, service_start_date: e.target.value || null })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Store date standard: YYYY-MM-DD. Auto-assigned when Service Status becomes Active.
                </p>
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

      {/* Action Needed Modal */}
      {showActionNeededModal && (
        <div
          className="fixed inset-0 bg-gray-500/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowActionNeededModal(false)}
        >
          <div className="bg-white rounded-lg max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Action Needed Issues</h3>
              <p className="text-sm text-gray-600 mt-1">{actionNeededClientName}</p>
            </div>

            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {actionNeededLoading ? (
                <p className="text-sm text-gray-600">Loading issues...</p>
              ) : actionNeededError ? (
                <p className="text-sm text-red-700">{actionNeededError}</p>
              ) : actionNeededIssues.length === 0 ? (
                <p className="text-sm text-gray-600">No action-needed issues found.</p>
              ) : (
                <div className="space-y-3">
                  {actionNeededIssues.map((issue) => (
                    <div key={issue.invoiceId} className="rounded-md border border-gray-200 p-3">
                      <p className="mb-2 text-sm font-medium text-red-700">
                        {issue.errorMessage || `Missing qbo_payment_url for invoice ${issue.qboDocNumber || issue.invoiceId}.`}
                      </p>
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <p><span className="font-semibold">Invoice ID:</span> {issue.invoiceId}</p>
                        <p><span className="font-semibold">QBO Doc #:</span> {issue.qboDocNumber || "N/A"}</p>
                        <p><span className="font-semibold">QBO Invoice ID:</span> {issue.qboInvoiceId || "N/A"}</p>
                        <p><span className="font-semibold">QBO Sync Status:</span> {issue.qboSyncStatus || "N/A"}</p>
                        <p><span className="font-semibold">Invoice Date:</span> {formatCalendarDate(issue.invoiceDate)}</p>
                        <p><span className="font-semibold">Due Date:</span> {formatCalendarDate(issue.dueDate)}</p>
                        <p><span className="font-semibold">Amount Total:</span> {formatCurrency(issue.amountTotal)}</p>
                        <p><span className="font-semibold">Amount Paid:</span> {formatCurrency(issue.amountPaid)}</p>
                        <p><span className="font-semibold">Updated:</span> {formatTimestampDate(issue.updatedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowActionNeededModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

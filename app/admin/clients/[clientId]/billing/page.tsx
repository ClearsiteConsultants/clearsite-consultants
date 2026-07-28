'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ReceiptText } from "lucide-react";
import Header from "@/components/Header";

type BillingStatus = "paid" | "partially_paid" | "overdue" | "pending";

type BillingInvoice = {
  id: string;
  qboInvoiceId: string | null;
  qboDocNumber: string | null;
  invoiceTotal: number;
  amountPaid: number;
  invoiceDate: string | null;
  dueDate: string | null;
  qboSyncStatus: string | null;
  paidAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  status: BillingStatus;
};

type BillingPayload = {
  client: {
    id: string;
    company_name: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    plan: string | null;
    service_status: string | null;
    maintenance_fee_frequency: string | null;
    next_invoice_due: string | null;
  };
  summary: {
    totalPaid: number;
    outstandingBalance: number;
    overdueCount: number;
    pendingCount: number;
  };
  invoices: BillingInvoice[];
};

const STATUS_STYLES: Record<BillingStatus, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  partially_paid: "bg-sky-100 text-sky-800",
  overdue: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
};

const STATUS_LABELS: Record<BillingStatus, string> = {
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  pending: "Pending",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
}

export default function ClientBillingHistoryPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [payload, setPayload] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && userType !== "admin") {
      router.push("/portal");
    }
  }, [status, router, userType]);

  useEffect(() => {
    if (status !== "authenticated" || userType !== "admin" || !params.clientId) {
      return;
    }

    const loadBillingHistory = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          `/api/admin/clients/${encodeURIComponent(params.clientId)}/billing`,
          { cache: "no-store" }
        );
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load billing history");
        }

        setPayload(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load billing history"
        );
      } finally {
        setLoading(false);
      }
    };

    loadBillingHistory();
  }, [status, userType, params.clientId]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-tech flex items-center justify-center">
        <p className="text-gray-600">Loading billing history...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-tech">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Home
        </Link>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        ) : payload ? (
          <>
            <div className="mb-8 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <ReceiptText className="h-8 w-8 text-primary" />
                <h1 className="font-display text-4xl text-gray-900">
                  {payload.client.company_name} Billing History
                </h1>
              </div>
              <p className="text-gray-600">{payload.client.email}</p>
            </div>

            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Total Paid
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatCurrency(payload.summary.totalPaid)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Outstanding
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatCurrency(payload.summary.outstandingBalance)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Pending
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {payload.summary.pendingCount}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Overdue
                </p>
                <p className="mt-2 text-2xl font-bold text-red-700">
                  {payload.summary.overdueCount}
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-2xl font-semibold text-gray-900">Invoices</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Run Manual Sync on Admin Home to refresh this history from QuickBooks.
                </p>
              </div>

              {payload.invoices.length === 0 ? (
                <p className="px-6 py-10 text-center text-gray-500">
                  No invoices found for this client.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="border-b bg-gray-50 text-left text-sm font-semibold text-gray-600">
                      <tr>
                        <th className="px-6 py-3">Invoice</th>
                        <th className="px-6 py-3">Invoice Date</th>
                        <th className="px-6 py-3">Due Date</th>
                        <th className="px-6 py-3">Total</th>
                        <th className="px-6 py-3">Paid</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">QuickBooks Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {invoice.qboDocNumber || "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {formatDate(invoice.invoiceDate)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {formatDate(invoice.dueDate)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(invoice.invoiceTotal)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(
                              invoice.status === "paid" && invoice.amountPaid === 0
                                ? invoice.invoiceTotal
                                : invoice.amountPaid
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[invoice.status]}`}
                            >
                              {STATUS_LABELS[invoice.status]}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm capitalize text-gray-700">
                            {(invoice.qboSyncStatus || "pending").replaceAll("_", " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

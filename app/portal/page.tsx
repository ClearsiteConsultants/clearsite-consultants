'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

interface Client {
  id: string;
  company_name: string;
  domain_name: string;
  plan: string | null;
  service_status: string;
  next_invoice_due: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  qbo_doc_number: string | null;
  invoice_total: number;
  amount_paid: number;
  invoice_date: string | null;
  due_date: string;
  qbo_payment_url: string | null;
  file_url: string | null;
  qbo_sync_status: string | null;
  paid_at: string | null;
  created_at: string;
  is_manual_link: boolean | null;
  has_pdf: boolean | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";

  // Handle both YYYY-MM-DD and ISO timestamps by using only the calendar date.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

export default function Portal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && userType === "admin") {
      router.push("/admin");
    }
  }, [status, router, userType]);

  useEffect(() => {
    const loadClient = async () => {
      if (status !== "authenticated" || userType !== "client") {
        return;
      }

      try {
        const response = await fetch("/api/clients/me", { cache: "no-store" });

        if (response.ok) {
          const data = await response.json();
          setClient(data);
        }

        const invoicesResponse = await fetch("/api/invoices", { cache: "no-store" });
        if (invoicesResponse.ok) {
          const invoiceRows = await invoicesResponse.json();
          setInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);
        }
      } catch (error) {
        console.error("Failed to load client profile", error);
      } finally {
        setLoading(false);
      }
    };

    if (status === "loading") {
      return;
    }

    loadClient();
  }, [status, userType]);

  const hasBillingAddress = Boolean(
    client?.billing_address_line1?.trim() &&
      client?.billing_city?.trim() &&
      client?.billing_state?.trim() &&
      client?.billing_postal_code?.trim() &&
      client?.billing_country?.trim()
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-tech flex items-center justify-center">
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

  if (!client && (session?.user as { user_type?: string } | undefined)?.user_type === "client") {
    return (
      <div className="min-h-screen bg-tech flex items-center justify-center px-6">
        <p className="text-gray-600 text-center">Unable to load your portal data right now. Please refresh and try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tech">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-5xl text-gray-900 mb-2">Client Portal</h1>
            <p className="text-gray-600">Welcome back, {session.user?.name}</p>
          </div>
        </div>

        {/* Account Info */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Plan</h3>
            <p className="text-2xl font-bold text-gray-900">{client?.plan || "Not enrolled"}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Service Status</h3>
            <p className={`text-2xl font-bold ${client?.service_status === "Active" ? "text-emerald-600" : "text-red-600"}`}>
              {client?.service_status || "N/A"}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Next Invoice Due</h3>
            <p className="text-2xl font-bold text-gray-900">{formatDate(client?.next_invoice_due)}</p>
          </div>
        </div>

        {/* Plan Management */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
          <h2 className="font-display text-3xl text-gray-900 mb-4">Manage Plan</h2>
          <p className="text-gray-700 mb-4">
            Plan updates and evaluations are managed by our team. Please contact support to request changes.
          </p>
          <Link
            href="/#contact"
            className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary/90"
          >
            Contact Us
          </Link>
        </div>

        {/* Invoices */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="font-display text-3xl text-gray-900 mb-4">Invoices</h2>
          {!hasBillingAddress && (
            <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Billing address required to receive services. Go to{" "}
              <a href="/account-settings" className="font-semibold underline">
                account settings
              </a>{" "}
              to add one.
            </p>
          )}
          {invoices.length === 0 ? (
            <p className="text-gray-600">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-500 uppercase">
                    <th className="py-3 pr-4">Invoice</th>
                    <th className="py-3 pr-4">Invoice Date</th>
                    <th className="py-3 pr-4">Due Date</th>
                    <th className="py-3 pr-4">Total</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Documents</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const status = (invoice.qbo_sync_status || "pending").toLowerCase();
                    const statusClass =
                      status === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : status === "sent"
                          ? "bg-blue-100 text-blue-700"
                          : status === "sync_error"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700";

                    // Prefer QuickBooks doc number; fall back to local invoice number.
                    const displayNumber = invoice.qbo_doc_number || invoice.invoice_number || "—";
                    const isManualLink = invoice.is_manual_link === true;
                    const payNowHref = invoice.qbo_payment_url || (invoice.has_pdf ? `/api/invoices/${invoice.id}/pdf` : invoice.file_url);

                    return (
                      <tr key={invoice.id} className="border-b border-gray-100">
                        <td className="py-4 pr-4 font-medium text-gray-900">
                          <span>{displayNumber}</span>
                          {isManualLink && (
                            <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 uppercase tracking-wide">
                              Manually linked
                            </span>
                          )}
                        </td>
                        <td className="py-4 pr-4 text-gray-700">{formatDate(invoice.invoice_date)}</td>
                        <td className="py-4 pr-4 text-gray-700">{formatDate(invoice.due_date)}</td>
                        <td className="py-4 pr-4 text-gray-900">${Number(invoice.invoice_total || 0).toFixed(2)}</td>
                        <td className="py-4 pr-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-wrap gap-3 text-sm">
                            {invoice.has_pdf && (
                              <a
                                href={`/api/invoices/${invoice.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-700 font-semibold hover:text-gray-900"
                              >
                                View PDF
                              </a>
                            )}
                            {!invoice.has_pdf && invoice.file_url && (
                              <a
                                href={invoice.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-700 font-semibold hover:text-gray-900"
                              >
                                View PDF
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-wrap gap-3 text-sm">
                            {payNowHref && status !== "paid" && (
                              <Button asChild size="sm" className="h-8 px-3 text-xs tracking-[0.12em]">
                                <a
                                  href={payNowHref}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Pay Now
                                </a>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Account Settings */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-8">
          <h2 className="font-display text-3xl text-gray-900 mb-2">Account Settings</h2>
          <p className="text-gray-600 mb-4">Manage your password and account preferences.</p>
          <a
            href="/account-settings"
            className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary/90"
          >
            Go to Account Settings
          </a>
        </div>
      </div>
    </div>
  );
}

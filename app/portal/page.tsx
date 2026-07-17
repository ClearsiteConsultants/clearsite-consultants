'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { buildMissingPaymentUrlContactHref } from "@/lib/portal-contact";

interface Client {
  id: string;
  company_name: string;
  domain_name: string;
  plan: string | null;
  service_status: string | null;
  maintenance_fee_frequency: string | null;
  next_invoice_due: string | null;
  service_start_date: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  // billing_country removed
}

interface Invoice {
  id: string;
  qbo_invoice_id: string | null;
  qbo_doc_number: string | null;
  invoice_total: number;
  amount_paid: number;
  invoice_date: string | null;
  due_date: string;
  qbo_payment_url: string | null;
  qbo_sync_status: string | null;
  paid_at: string | null;
  created_at: string;
  is_manual_link: boolean | null;
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
  const MAINTENANCE_FEES: Record<string, Record<string, number>> = {
    "Starter": {
      "Monthly": 10,
      "Yearly": 100,
    },
    "Feature-Rich": {
      "Monthly": 20,
      "Yearly": 200,
    },
  };

  const getMaintenanceFee = (plan: string | null, frequency: string | null) => {
    if (!plan || !frequency) return null;
    return MAINTENANCE_FEES[plan]?.[frequency] ?? null;
  };

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

  const firstMissingPaymentUrlInvoice = invoices.find((invoice) => {
    const status = (invoice.qbo_sync_status || "pending").toLowerCase();
    const isUnpaid = status !== "paid";
    return isUnpaid && !(invoice.qbo_payment_url || "").trim();
  });

  const missingPaymentUrlContactHref = firstMissingPaymentUrlInvoice
    ? buildMissingPaymentUrlContactHref(firstMissingPaymentUrlInvoice.id, firstMissingPaymentUrlInvoice.qbo_doc_number)
    : "/#contact";

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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Plan</h3>
            <div className="flex flex-col">
              <p className="text-2xl font-bold text-gray-900">{client?.plan || "Not Enrolled"}</p>
              {client?.plan && client?.maintenance_fee_frequency && (
                <p className="text-sm font-medium text-gray-500 mt-1">
                  {getMaintenanceFee(client.plan, client.maintenance_fee_frequency)
                    ? `Maintenance Fee $${getMaintenanceFee(client.plan, client.maintenance_fee_frequency)}/${client.maintenance_fee_frequency === "Monthly" ? "mo" : "yr"}`
                    : `Billed ${client.maintenance_fee_frequency}`}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Service Status</h3>
            <p className={`text-2xl font-bold ${
              client?.service_status === "Active" 
                ? "text-emerald-600" 
                : "text-gray-400"
            }`}>
              {client?.service_status === "Active" ? "Active" : "Inactive"}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Next Invoice Due</h3>
            <p className="text-2xl font-bold text-gray-900">{formatDate(client?.next_invoice_due)}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Service Started</h3>
            <p className="text-2xl font-bold text-gray-900">{formatDate(client?.service_start_date)}</p>
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
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="font-display text-3xl text-gray-900">Invoices</h2>
            {firstMissingPaymentUrlInvoice && (
              <div className="w-full max-w-3xl md:w-auto">
                <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3 text-sm">
                  <p className="min-w-0 break-words text-center text-red-700">
                    One or more invoices is missing a payment link. Contact customer support for assistance.
                  </p>
                  <div className="justify-self-center">
                    <Button asChild variant="outline" size="sm" className="h-8 w-fit px-3 text-xs tracking-[0.08em]">
                      <a href={missingPaymentUrlContactHref}>Contact Support</a>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
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

                    // Prefer QuickBooks doc number.
                    const displayNumber = invoice.qbo_doc_number || "—";
                    const isUnpaid = status !== "paid";
                    const paymentUrl = (invoice.qbo_payment_url || "").trim();

                    return (
                      <tr key={invoice.id} className="border-b border-gray-100">
                        <td className="py-4 pr-4 font-medium text-gray-900">
                          <span>{displayNumber}</span>
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
                            {invoice.qbo_invoice_id && (
                              <a
                                href={`/api/invoices/${invoice.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-700 font-semibold hover:text-gray-900"
                              >
                                Download PDF
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-col gap-1 text-sm">
                            {isUnpaid && paymentUrl ? (
                              <div className="flex items-center gap-3">
                                <Button asChild size="sm" className="h-8 w-fit px-3 text-xs tracking-[0.12em]">
                                  <a
                                    href={paymentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Pay invoice with QuickBooks (opens in new tab)"
                                  >
                                    PAY NOW
                                  </a>
                                </Button>

                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>via</span>
                                  <Image src="/quickbooks.svg" alt="QuickBooks" width={120} height={40} className="h-10 w-auto" />
                                </div>
                              </div>
                            ) : isUnpaid && !paymentUrl ? (
                              <>
                                <div className="flex items-center gap-3">
                                  <Button size="sm" disabled className="h-8 w-fit px-3 text-xs tracking-[0.12em]">
                                    <a
                                      href="#"
                                      aria-label="Pay invoice with QuickBooks (contact support for payment link)"
                                    >
                                      PAY NOW
                                    </a>
                                  </Button>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>via</span>
                                    <Image src="/quickbooks.svg" alt="QuickBooks" width={120} height={40} className="h-10 w-auto" />
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">Contact support to obtain a payment link.</div>
                              </>
                            ) : null}
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
        {/* Trademark Disclaimer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider">
            QuickBooks and the QuickBooks logo are registered trademarks of Intuit Inc.
          </p>
        </div>
      </div>
    </div>
  );
}

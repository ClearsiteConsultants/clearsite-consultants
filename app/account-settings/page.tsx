'use client';

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { BILLING_FIELD_LIMITS, BillingField } from "@/lib/field-limits";

function AccountSettingsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [billingLoading, setBillingLoading] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingMessage, setBillingMessage] = useState({ type: "", text: "" });
  const [billingForm, setBillingForm] = useState({
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_postal_code: "",
  });
  const [attemptedExceed, setAttemptedExceed] = useState<Partial<Record<BillingField, boolean>>>({});

  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  const firstName = (session?.user as { first_name?: string } | undefined)?.first_name;
  const lastName = (session?.user as { last_name?: string } | undefined)?.last_name;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const loadBilling = async () => {
      if (status !== "authenticated" || userType !== "client") return;
      setBillingLoading(true);
      try {
        const response = await fetch("/api/clients/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        setBillingForm({
          billing_address_line1: payload.billing_address_line1 || "",
          billing_address_line2: payload.billing_address_line2 || "",
          billing_city: payload.billing_city || "",
          billing_state: payload.billing_state || "",
          billing_postal_code: payload.billing_postal_code || "",
        });
      } catch {
        setBillingMessage({ type: "error", text: "Unable to load billing address." });
      } finally {
        setBillingLoading(false);
      }
    };

    loadBilling();
  }, [status, userType]);

  const handleBillingChange = (field: BillingField, value: string) => {
    const limit = BILLING_FIELD_LIMITS[field];

    if (limit && value.length > limit) {
      if (!attemptedExceed[field]) {
        setAttemptedExceed((prev) => ({ ...prev, [field]: true }));
      }
      return;
    }

    setBillingForm((prev) => ({ ...prev, [field]: value }));
    const isAtLimit = limit ? value.length >= limit : false;

    // If they delete characters, reset the "attempted to exceed" state
    if (!isAtLimit) {
      setAttemptedExceed((prev) => ({ ...prev, [field]: false }));
    }
  };

  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
  ];

  const handleBillingSave = async (event: React.FormEvent) => {
    event.preventDefault();

    // Client-side validation final check
    const overLimitFields = (Object.keys(billingForm) as BillingField[]).filter(field => {
      const limit = BILLING_FIELD_LIMITS[field];
      return limit && (billingForm[field]?.length || 0) > limit;
    });

    if (overLimitFields.length > 0) {
      setBillingMessage({ type: "error", text: "Some fields exceed character limits. Please correct them before saving." });
      return;
    }

    setSavingBilling(true);
    setBillingMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/clients/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billingForm),
      });

      const payload = await response.json();
      if (!response.ok) {
        setBillingMessage({ type: "error", text: payload?.error || "Unable to save billing address." });
        return;
      }

      setBillingMessage({
        type: payload?.warning ? "error" : "success",
        text: payload?.warning || "Billing address saved successfully.",
      });
    } catch {
      setBillingMessage({ type: "error", text: "Unable to save billing address." });
    } finally {
      setSavingBilling(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-tech flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const backHref = userType === "admin" ? "/admin" : "/portal";
  const backLabel = userType === "admin" ? "Admin Dashboard" : "Client Portal";
  const displayName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : (session.user?.name ?? session.user?.email ?? "");

  return (
    <div className="min-h-screen bg-tech">
      <Header />
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-5xl text-gray-900 mb-2">Account Settings</h1>
            {displayName && <p className="text-gray-600">{displayName}</p>}
          </div>
          <a
            href={backHref}
            className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition uppercase tracking-[0.18em] text-sm font-semibold"
          >
            {backLabel}
          </a>
        </div>

        {/* Change Password */}
        {userType === "client" && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="font-display text-3xl text-gray-900 mb-2">Change Password</h2>
            <p className="text-gray-600 mb-6">Redirect to a secure page to update your account credentials.</p>

            <button
              type="button"
              onClick={() => {
                // Sign out and redirect to login, then back to change-password
                signOut({ callbackUrl: "/login?callbackUrl=/change-password" });
              }}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-red-700"
            >
              Change Password
            </button>
          </div>
        )}

        {userType === "client" && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-8">
            <h2 className="font-display text-3xl text-gray-900 mb-2">Billing Address</h2>
            <p className="text-gray-600 mb-4">Billing address is required for invoicing.</p>

            {billingMessage.text && (
              <div
                className={`mb-4 rounded-lg p-3 text-sm ${
                  billingMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {billingMessage.text}
              </div>
            )}

            {billingLoading ? (
              <p className="text-gray-600">Loading billing address...</p>
            ) : (
              <form onSubmit={handleBillingSave} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-gray-700">Address Line 1 *</label>
                    {attemptedExceed.billing_address_line1 && (
                      <span className="text-[10px] font-bold uppercase text-red-600 animate-pulse">Maximum length reached</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={billingForm.billing_address_line1}
                    onChange={(event) => handleBillingChange("billing_address_line1", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                    {attemptedExceed.billing_address_line2 && (
                      <span className="text-[10px] font-bold uppercase text-red-600 animate-pulse">Maximum length reached</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={billingForm.billing_address_line2}
                    onChange={(event) => handleBillingChange("billing_address_line2", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-gray-700">City *</label>
                    {attemptedExceed.billing_city && (
                      <span className="text-[10px] font-bold uppercase text-red-600 animate-pulse">Maximum length reached</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={billingForm.billing_city}
                    onChange={(event) => handleBillingChange("billing_city", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">State *</label>
                  <select
                    value={billingForm.billing_state}
                    onChange={(event) => handleBillingChange("billing_state", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="">Select State</option>
                    {US_STATES.map((abbr) => (
                      <option key={abbr} value={abbr}>{abbr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-gray-700">Postal Code *</label>
                    {attemptedExceed.billing_postal_code && (
                      <span className="text-[10px] font-bold uppercase text-red-600 animate-pulse">Maximum length reached</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={billingForm.billing_postal_code}
                    onChange={(event) => handleBillingChange("billing_postal_code", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                {/* Country field removed: US only */}

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={savingBilling}
                    className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingBilling ? "Saving..." : "Save Billing Address"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountSettings() {
  return <AccountSettingsContent />;
}

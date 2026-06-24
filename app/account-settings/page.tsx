'use client';

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { BILLING_FIELD_LIMITS, BillingField, ACCOUNT_INFO_FIELD_LIMITS, AccountInfoField } from "@/lib/field-limits";
import { Button } from "@/components/ui/button";
import { Pencil, Eye, EyeOff } from "lucide-react";

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function AccountSettingsContent() {
  const { data: session, status, update } = useSession();
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

  const [accountLoading, setAccountLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });
  const [accountForm, setAccountForm] = useState({
    company_name: "",
    phone: "",
    email: "",
    currentPassword: "",
  });
  const [originalEmail, setOriginalEmail] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<AccountInfoField | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showDialogPassword, setShowDialogPassword] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [attemptedExceed, setAttemptedExceed] = useState<Partial<Record<BillingField | AccountInfoField, boolean>>>({});

  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  const firstName = (session?.user as { first_name?: string } | undefined)?.first_name;
  const lastName = (session?.user as { last_name?: string } | undefined)?.last_name;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const loadData = async () => {
      if (status !== "authenticated" || userType !== "client") return;
      setBillingLoading(true);
      setAccountLoading(true);
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
        setAccountForm({
          company_name: payload.company_name || "",
          phone: payload.phone || "",
          email: payload.email || "",
          currentPassword: "",
        });
        setOriginalEmail(payload.email || "");
      } catch {
        setBillingMessage({ type: "error", text: "Unable to load billing address." });
        setAccountMessage({ type: "error", text: "Unable to load account information." });
      } finally {
        setBillingLoading(false);
        setAccountLoading(false);
      }
    };

    loadData();
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

  const handleOpenEditDialog = (field: AccountInfoField) => {
    setEditingField(field);
    setTempValue(accountForm[field] || "");
    setTempPassword("");
    setShowDialogPassword(false);
    setDialogError("");
    setIsDialogOpen(true);
    setAccountMessage({ type: "", text: "" });
  };

  const handleDialogSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingField) return;

    const hasChanged = tempValue !== (accountForm[editingField] || "");
    
    // If no change and no password, just close without message
    if (!hasChanged && !tempPassword) {
      setIsDialogOpen(false);
      return;
    }

    setSavingAccount(true);
    setDialogError("");

    // Build the payload with the updated field and current values for others
    const payload = {
      ...accountForm,
      [editingField]: tempValue,
      currentPassword: tempPassword,
    };

    try {
      const response = await fetch("/api/clients/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setDialogError(data?.error || "Unable to save account info.");
        return;
      }

      if (hasChanged) {
        setAccountMessage({ type: "success", text: "Account information saved successfully." });
      }
      
      // Update local state
      setAccountForm(prev => ({
        ...prev,
        [editingField]: tempValue,
        currentPassword: "",
      }));

      // If email changed, update the session
      if (editingField === "email" && tempValue !== originalEmail) {
        await update({ email: tempValue });
        setOriginalEmail(tempValue);
      }
      
      setIsDialogOpen(false);
    } catch {
      setDialogError("Unable to save account info.");
    } finally {
      setSavingAccount(false);
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

        {/* Account Info */}
        {userType === "client" && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
            <h2 className="font-display text-3xl text-gray-900 mb-2">Account Info</h2>
            <p className="text-gray-600 mb-6">Update your basic account details.</p>

            {accountMessage.text && (
              <div
                className={`mb-4 rounded-lg p-3 text-sm ${
                  accountMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {accountMessage.text}
              </div>
            )}

            {accountLoading ? (
              <p className="text-gray-600">Loading account information...</p>
            ) : (
              <div className="space-y-6">
                {[
                  { id: "company_name", label: "Company Name", value: accountForm.company_name },
                  { id: "phone", label: "Phone Number", value: accountForm.phone || "Not set" },
                  { id: "email", label: "Email Address", value: accountForm.email },
                ].map((field) => (
                  <div key={field.id} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{field.label}</p>
                      <p className="text-lg text-gray-900">{field.value}</p>
                    </div>
                    <button
                      onClick={() => handleOpenEditDialog(field.id as AccountInfoField)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title={`Edit ${field.label}`}
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isDialogOpen && (
              <div
                className="fixed inset-0 bg-gray-500/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                onClick={() => setIsDialogOpen(false)}
              >
                <div className="bg-white rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                  <form onSubmit={handleDialogSave}>
                    <div className="px-6 py-4 border-b">
                      <h3 className="text-lg font-semibold">
                        Edit {editingField === "company_name" ? "Company Name" : editingField === "phone" ? "Phone Number" : "Email Address"}
                      </h3>
                    </div>
                    
                    <div className="px-6 py-4 space-y-4">
                      {dialogError && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100">
                          {dialogError}
                        </div>
                      )}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {editingField === "company_name" ? "Company Name" : editingField === "phone" ? "Phone Number" : "Email Address"}
                          </label>
                          {editingField && tempValue.length >= ACCOUNT_INFO_FIELD_LIMITS[editingField] && (
                            <span className="text-[10px] font-bold uppercase text-red-600 animate-pulse">Max length reached</span>
                          )}
                        </div>
                        <input
                          type={editingField === "email" ? "email" : editingField === "phone" ? "tel" : "text"}
                          value={tempValue}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (editingField === "phone") {
                              val = formatPhoneNumber(val);
                            } else if (editingField) {
                              const limit = ACCOUNT_INFO_FIELD_LIMITS[editingField];
                              if (limit && val.length > limit) return;
                            }
                            setTempValue(val);
                          }}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          required={editingField !== "phone"}
                          autoComplete={editingField === "company_name" ? "organization" : editingField === "phone" ? "tel" : "email"}
                          inputMode={editingField === "phone" ? "numeric" : "text"}
                          placeholder={editingField === "phone" ? "(555) 123-4567" : ""}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showDialogPassword ? "text" : "password"}
                            value={tempPassword}
                            onChange={(e) => setTempPassword(e.target.value)}
                            placeholder="Confirm with your password"
                            className="w-full rounded-xl border border-gray-300 pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowDialogPassword(!showDialogPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                            aria-label={showDialogPassword ? "Hide password" : "Show password"}
                          >
                            {showDialogPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        disabled={savingAccount}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={savingAccount}>
                        {savingAccount ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

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
                    autoComplete="address-line1"
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
                    autoComplete="address-line2"
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
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">State *</label>
                  <select
                    value={billingForm.billing_state}
                    onChange={(event) => handleBillingChange("billing_state", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                    autoComplete="address-level1"
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
                    autoComplete="postal-code"
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

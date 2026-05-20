'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export default function AccountSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isPasswordPromptComplete, setIsPasswordPromptComplete] = useState(false);
  const [passwordPromptValue, setPasswordPromptValue] = useState("");
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [billingForm, setBillingForm] = useState({
    billing_address_line1: "",
    billing_address_line2: "",
    billing_address_city: "",
    billing_address_state: "",
    billing_address_zip: "",
    billing_address_country: "",
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingMessage, setBillingMessage] = useState({ type: "", text: "" });
  const [billingLoaded, setBillingLoaded] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const loadBillingAddress = async () => {
      if (status !== "authenticated") return;
      const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
      if (userType !== "client") return;

      try {
        const res = await fetch("/api/clients/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setBillingForm({
            billing_address_line1: data.billing_address_line1 ?? "",
            billing_address_line2: data.billing_address_line2 ?? "",
            billing_address_city: data.billing_address_city ?? "",
            billing_address_state: data.billing_address_state ?? "",
            billing_address_zip: data.billing_address_zip ?? "",
            billing_address_country: data.billing_address_country ?? "",
          });
        }
      } catch {
        // Ignore load errors; form stays empty
      } finally {
        setBillingLoaded(true);
      }
    };

    loadBillingAddress();
  }, [status, session]);

  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  const firstName = (session?.user as { first_name?: string } | undefined)?.first_name;
  const lastName = (session?.user as { last_name?: string } | undefined)?.last_name;

  const handlePasswordFieldChange = (field: "newPassword" | "confirmPassword", value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordPromptContinue = (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!passwordPromptValue) {
      setPasswordMessage({ type: "error", text: "Please enter your current password to continue." });
      return;
    }

    setPasswordMessage({ type: "", text: "" });
    setPasswordForm((prev) => ({ ...prev, currentPassword: passwordPromptValue }));
    setIsPasswordPromptComplete(true);
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage({ type: "", text: "" });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload?.error === "Invalid current password") {
          setPasswordPromptValue("");
          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
          setIsPasswordPromptComplete(false);
        }

        setPasswordMessage({
          type: "error",
          text: payload?.error || "Unable to change password.",
        });
        return;
      }

      setPasswordMessage({ type: "success", text: "Password updated successfully." });
      setPasswordPromptValue("");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordPromptComplete(false);
      setShowPasswordForm(false);
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to change password.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleBillingFieldChange = (field: keyof typeof billingForm, value: string) => {
    setBillingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBillingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBillingMessage({ type: "", text: "" });
    setSavingBilling(true);

    try {
      const response = await fetch("/api/clients/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_address_line1: billingForm.billing_address_line1 || null,
          billing_address_line2: billingForm.billing_address_line2 || null,
          billing_address_city: billingForm.billing_address_city || null,
          billing_address_state: billingForm.billing_address_state || null,
          billing_address_zip: billingForm.billing_address_zip || null,
          billing_address_country: billingForm.billing_address_country || null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setBillingMessage({ type: "error", text: payload?.error || "Unable to save billing address." });
        return;
      }

      setBillingMessage({ type: "success", text: "Billing address saved successfully." });
    } catch (error) {
      setBillingMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to save billing address.",
      });
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
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="font-display text-3xl text-gray-900 mb-2">Change Password</h2>

          {passwordMessage.text && (
            <div
              className={`mb-4 rounded-lg p-3 text-sm ${
                passwordMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => {
                setPasswordMessage({ type: "", text: "" });
                setPasswordPromptValue("");
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                setIsPasswordPromptComplete(false);
                setShowPasswordForm(true);
              }}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-red-700"
            >
              Change Password
            </button>
          ) : (
            <>
              {!isPasswordPromptComplete ? (
                <form onSubmit={handlePasswordPromptContinue} className="grid gap-4 md:grid-cols-2" autoComplete="off">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Confirm Your Current Password</label>
                    <input
                      type="password"
                      value={passwordPromptValue}
                      onChange={(event) => setPasswordPromptValue(event.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-3">
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary/90"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordPromptValue("");
                        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        setPasswordMessage({ type: "", text: "" });
                        setIsPasswordPromptComplete(false);
                        setShowPasswordForm(false);
                      }}
                      className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">{PASSWORD_POLICY_MESSAGE}</p>

                  <form onSubmit={handlePasswordChange} className="grid gap-4 md:grid-cols-2" autoComplete="off">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">New Password</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) => handlePasswordFieldChange("newPassword", event.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) => handlePasswordFieldChange("confirmPassword", event.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div className="md:col-span-2 flex gap-3">
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {changingPassword ? "Updating..." : "Update Password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordPromptValue("");
                          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                          setPasswordMessage({ type: "", text: "" });
                          setIsPasswordPromptComplete(false);
                          setShowPasswordForm(false);
                        }}
                        className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-gray-700 transition hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        {/* Billing Address (clients only) */}
        {userType === "client" && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-8">
            <h2 className="font-display text-3xl text-gray-900 mb-2">Billing Address</h2>
            <p className="text-gray-600 mb-4">Update the billing address associated with your account.</p>

            {billingMessage.text && (
              <div
                className={`mb-4 rounded-lg p-3 text-sm ${
                  billingMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {billingMessage.text}
              </div>
            )}

            {!billingLoaded ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <form onSubmit={handleBillingSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Address Line 1</label>
                  <input
                    type="text"
                    value={billingForm.billing_address_line1}
                    onChange={(e) => handleBillingFieldChange("billing_address_line1", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="123 Main St"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Address Line 2</label>
                  <input
                    type="text"
                    value={billingForm.billing_address_line2}
                    onChange={(e) => handleBillingFieldChange("billing_address_line2", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Suite 100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    value={billingForm.billing_address_city}
                    onChange={(e) => handleBillingFieldChange("billing_address_city", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Chicago"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    value={billingForm.billing_address_state}
                    onChange={(e) => handleBillingFieldChange("billing_address_state", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="IL"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">ZIP Code</label>
                  <input
                    type="text"
                    value={billingForm.billing_address_zip}
                    onChange={(e) => handleBillingFieldChange("billing_address_zip", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="60601"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Country</label>
                  <input
                    type="text"
                    value={billingForm.billing_address_country}
                    onChange={(e) => handleBillingFieldChange("billing_address_country", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="United States"
                  />
                </div>

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

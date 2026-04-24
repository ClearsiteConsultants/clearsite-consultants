'use client';

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

interface Client {
  id: string;
  company_name: string;
  domain_name: string;
  plan: string;
  service_status: string;
  next_invoice_due: string | null;
}

export default function Portal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState(false);
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.user_type === "admin") {
      router.push("/admin/clients");
    }
  }, [status, router, session]);

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
        await res.json();
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
        await res.json();
        setClient({ ...client, service_status: "Canceled" });
      }
    } catch (error) {
      console.error("Failed to cancel service", error);
    }
  };

  const handlePasswordFieldChange = (field: "currentPassword" | "newPassword" | "confirmPassword", value: string) => {
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

  return (
    <div className="min-h-screen bg-tech">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-5xl text-gray-900 mb-2">Client Portal</h1>
            <p className="text-gray-600">Welcome back, {session.user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition uppercase tracking-[0.18em] text-sm font-semibold"
          >
            Sign Out
          </button>
        </div>

        {/* Account Info */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Plan</h3>
            <p className="text-2xl font-bold text-gray-900">Starter</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Service Status</h3>
            <p className="text-2xl font-bold text-emerald-600">Active</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Next Invoice Due</h3>
            <p className="text-2xl font-bold text-gray-900">N/A</p>
          </div>
        </div>

        {/* Plan Management */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
          <h2 className="font-display text-3xl text-gray-900 mb-4">Manage Plan</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Change Plan</label>
              <select
                onChange={(e) => handlePlanChange(e.target.value)}
                disabled={updatingPlan}
                className="w-full sm:w-64 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Starter">Starter</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <button
              onClick={handleCancelService}
              className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition mt-6 uppercase tracking-[0.18em] text-sm font-semibold"
            >
              Cancel Service
            </button>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="font-display text-3xl text-gray-900 mb-4">Invoices</h2>
          <p className="text-gray-600">No invoices yet.</p>
        </div>

        {/* Password */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-8">
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
      </div>
    </div>
  );
}

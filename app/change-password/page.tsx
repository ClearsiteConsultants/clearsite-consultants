'use client';

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/Header";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

function ChangePasswordContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const secToken = searchParams.get("sec_token");
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

  // If no secToken and not logged in, redirect to login
  useEffect(() => {
    if (status === "unauthenticated" && !secToken) {
      router.push("/login?callbackUrl=/change-password");
    }
  }, [status, secToken, router]);

  // Ensure only clients can access this page
  useEffect(() => {
    if (status === "authenticated" && userType !== "client") {
      router.push("/admin");
    }
  }, [status, userType, router]);

  const handlePasswordFieldChange = (field: "currentPassword" | "newPassword" | "confirmPassword", value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
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
        body: JSON.stringify({
          ...passwordForm,
          sec_token: secToken,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setPasswordMessage({
          type: "error",
          text: payload?.error || "Unable to change password.",
        });
        return;
      }

      setPasswordMessage({ type: "success", text: "Password updated successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      
      if (secToken) {
        // If they used a sec_token (Security Alert), keep original behavior:
        // redirect to login after success only if not currently logged in.
        if (!session) {
          setTimeout(() => router.push("/login"), 3000);
        }
      } else {
        // Otherwise (changing from account settings), redirect to portal
        setTimeout(() => router.push("/portal"), 3000);
      }
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to change password.",
      });
    } finally {
      setChangingPassword(false);
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

  // If no session and no token (after the useEffect redirect), show nothing or a message
  if (!session && !secToken && status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-tech">
      <Header />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-5xl text-gray-900 mb-2">Change Password</h1>
            <p className="text-gray-600">Securely update your account credentials.</p>
          </div>
          {session && (
            <a
              href="/account-settings"
              className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition uppercase tracking-[0.18em] text-sm font-semibold"
            >
              Back to Settings
            </a>
          )}
        </div>

        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          {passwordMessage.text && (
            <div
              className={`mb-6 rounded-lg p-4 text-sm ${
                passwordMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {passwordMessage.text}
              {passwordMessage.type === "success" && secToken && !session && (
                <p className="mt-2">Redirecting to login...</p>
              )}
              {passwordMessage.type === "success" && !secToken && (
                <p className="mt-2">Redirecting to portal...</p>
              )}
            </div>
          )}

          <p className="text-sm text-gray-600 mb-6">{PASSWORD_POLICY_MESSAGE}</p>

          <form onSubmit={handlePasswordChange} className="grid gap-6" autoComplete="off">
            {!secToken && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(event) => handlePasswordFieldChange("currentPassword", event.target.value)}
                    className="w-full rounded-xl border border-gray-300 pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(event) => handlePasswordFieldChange("newPassword", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(event) => handlePasswordFieldChange("confirmPassword", event.target.value)}
                  className="w-full rounded-xl border border-gray-300 pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={changingPassword}
                className="flex-1 rounded-xl bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-tech flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ChangePasswordContent />
    </Suspense>
  );
}

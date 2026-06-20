'use client';

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Header from "@/components/Header";

function ChangeEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [secToken, setSecToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = searchParams.get("sec_token");
    if (token) {
      setSecToken(token);
    } else {
      setMessage({ type: "error", text: "Invalid or missing security token." });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secToken) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sec_token: secToken,
          email: email,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: payload.error || "Failed to update email address." });
        return;
      }

      setSuccess(true);
      setMessage({ type: "success", text: "Email address updated successfully. You can now log in with your new email." });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setMessage({ type: "error", text: "An error occurred while updating your email." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tech">
      <Header />
      <div className="max-w-md mx-auto px-6 py-24">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h1 className="font-display text-4xl text-gray-900 mb-6 text-center">Update Email</h1>
          
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl text-sm ${
              message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
            }`}>
              {message.text}
            </div>
          )}

          {!success && secToken && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-gray-600 text-sm">
                Enter the email address you would like to use for your account. This action does not require your current password because you validated it via email.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200"
              >
                {loading ? "Updating..." : "Update Email Address"}
              </button>
            </form>
          )}

          {!secToken && !message.text && (
            <div className="text-center">
              <p className="text-gray-600 mb-6">No security token found. Please use the link provided in your security alert email.</p>
              <button
                onClick={() => router.push("/login")}
                className="text-blue-600 font-semibold hover:underline"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChangeEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-tech flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ChangeEmailContent />
    </Suspense>
  );
}

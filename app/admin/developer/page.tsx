'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

type ErrorLogRow = {
  id: number;
  level: string;
  route: string;
  method: string;
  status_code: number | null;
  error_name: string | null;
  error_message: string;
  user_id: string | null;
  user_type: string | null;
  created_at: string;
};

type ErrorLogRetention = {
  days: number;
  maxRetained: number;
};

const DEFAULT_RETENTION: ErrorLogRetention = {
  days: 30,
  maxRetained: 150,
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DeveloperLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [retention, setRetention] = useState<ErrorLogRetention>(DEFAULT_RETENTION);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && userType !== "admin") {
      router.push("/portal");
    }
  }, [router, status, userType]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim()) params.set("query", query.trim());

      const res = await fetch(`/api/admin/logs?${params.toString()}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load logs");
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total || 0));
      const retentionPayload = payload.retention as Partial<ErrorLogRetention> | undefined;
      setRetention({
        days: Number(retentionPayload?.days) || DEFAULT_RETENTION.days,
        maxRetained: Number(retentionPayload?.maxRetained) || DEFAULT_RETENTION.maxRetained,
      });
      setSelectedIds([]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to load logs";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && userType === "admin") {
      loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userType, page]);

  const toggleSelection = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((value) => value !== id);
    });
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;

    try {
      setBusy(true);
      setConfirmDeleteOpen(false);
      const res = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete logs");
      }
      setMessage({ type: "success", text: `Deleted ${payload.deletedByIds || 0} log entries.` });
      await loadLogs();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to delete logs";
      setMessage({ type: "error", text });
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 bg-gray-500/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => !busy && setConfirmDeleteOpen(false)}
        >
          <div className="bg-white rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Delete selected log entries?</h3>
              <p className="mt-1 text-sm text-gray-600">
                This will permanently delete {selectedIds.length} selected log entr{selectedIds.length === 1 ? "y" : "ies"}.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void deleteSelected()} disabled={busy || !selectedIds.length}>
                {busy ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Header />
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Developer Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Persistent API server errors retained for {retention.days} days up to {retention.maxRetained} entries.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {message && (
          <div
            className={`mb-4 rounded-md border px-4 py-3 text-sm ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search route, message, method, or user"
            className="min-w-[280px] rounded-md border px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            onClick={() => {
              setPage(1);
              loadLogs();
            }}
            disabled={loading || busy}
          >
            Search
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={!selectedIds.length || loading || busy}>
            Delete Selected
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Select</th>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Route</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Error</th>
                <th className="px-3 py-2 text-left">User</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-500" colSpan={7}>
                    No logs found.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) => toggleSelection(row.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                  <td className="px-3 py-2">{row.route}</td>
                  <td className="px-3 py-2">{row.method}</td>
                  <td className="px-3 py-2">{row.status_code ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.error_name || "Error"}</div>
                    <div className="max-w-[420px] break-words text-gray-600">{row.error_message}</div>
                  </td>
                  <td className="px-3 py-2">{row.user_id || "anonymous"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
          <div>
            Showing page {page} of {totalPages} ({total} total logs)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading || busy}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading || busy}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

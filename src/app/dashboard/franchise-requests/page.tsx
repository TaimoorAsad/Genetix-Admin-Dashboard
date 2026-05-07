"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Request = {
  id: string;
  uid: string;
  email: string;
  franchiseName: string;
  phone?: string;
  number?: string;
  status: string;
  createdAt: string | null;
};

export default function FranchiseRequestsPage() {
  const { idToken, roleInfo } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!idToken) return;
    fetch(`/api/franchise-requests?status=${filter}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (r.status === 403) throw new Error("Admin only");
        return r.ok ? r.json() : Promise.reject(new Error("Failed to load"));
      })
      .then((data) => setRequests(data.requests || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [idToken, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    if (!idToken) return;
    setActingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/franchise-requests/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d.error as string) || "Approve failed");
      }
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!idToken || !confirm("Reject this franchise request?")) return;
    setActingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/franchise-requests/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d.error as string) || "Reject failed");
      }
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActingId(null);
    }
  };

  if (roleInfo?.role !== "admin") {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Franchise requests</h1>
        <p className="text-[#718096]">Only admins can view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Franchise requests</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-2">Franchise requests</h1>
      <p className="text-[#718096] text-sm mb-6">Approve or reject new franchise signups. When approved, they can log in with their email and password.</p>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === "pending" ? "bg-[#4059ad] text-white" : "bg-white border border-[#e2e8f0] text-[#718096] hover:bg-[#f8f9fa]"}`}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === "all" ? "bg-[#4059ad] text-white" : "bg-white border border-[#e2e8f0] text-[#718096] hover:bg-[#f8f9fa]"}`}
        >
          All
        </button>
      </div>
      <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-12 text-center text-[#718096]">
            {filter === "pending" ? "No pending requests." : "No requests."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fa] border-b border-[#e2e8f0]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Email</th>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Franchise name</th>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Phone</th>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Number</th>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Status</th>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Date</th>
                  <th className="px-4 py-3 font-semibold text-[#2d3748]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f8f9fa]">
                    <td className="px-4 py-3 text-[#2d3748]">{r.email}</td>
                    <td className="px-4 py-3 text-[#2d3748]">{r.franchiseName}</td>
                    <td className="px-4 py-3 text-[#718096]">{r.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-[#718096]">{r.number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : r.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#718096]">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(r.id)}
                            disabled={actingId !== null}
                            className="px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-xs font-medium disabled:opacity-50"
                          >
                            {actingId === r.id ? "Approving…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(r.id)}
                            disabled={actingId !== null}
                            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

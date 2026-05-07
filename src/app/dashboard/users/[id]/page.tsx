"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type UserData = Record<string, unknown> & {
  id: string;
  "Full Name"?: string;
  "Phone Number"?: string;
  Email?: string;
  isEliteMember?: boolean;
  ReferralCount?: number;
  ReferralPoints?: number;
};

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { idToken, roleInfo } = useAuth();
  const isAdmin = roleInfo?.role === "admin";
  const canEdit = isAdmin || Boolean(roleInfo?.permissions?.canEditUsers);
  const canDelete = isAdmin || Boolean(roleInfo?.permissions?.canDeleteUsers);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<UserData>>({});

  useEffect(() => {
    if (!idToken) return;
    fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then((data) => {
        setUser(data);
        setForm({
          "Full Name": data["Full Name"],
          Email: data.Email,
          isEliteMember: data.isEliteMember,
          ReferralCount: data.ReferralCount,
          ReferralPoints: data.ReferralPoints,
        });
      })
      .catch(() => setError("User not found"))
      .finally(() => setLoading(false));
  }, [id, idToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      const updated = await res.json();
      setUser(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!idToken || !confirm("Delete this user? This will remove Firestore data and Auth account.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/dashboard/users");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-[#718096]">Loading...</p>;
  if (error && !user) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/users" className="mt-4 inline-block text-[#4059ad] hover:underline font-medium">
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <Link href="/dashboard/users" className="text-[#718096] hover:text-[#2d3748] text-sm font-medium">
          ← Users
        </Link>
        <Link
          href={`/dashboard/users/${id}/fingerprints`}
          className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium shadow-sm transition"
        >
          View fingerprint data
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Edit User</h1>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}
      <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
        <form onSubmit={handleSave} className="max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#2d3748] mb-1">Full Name</label>
          <input
            type="text"
            value={form["Full Name"] ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, "Full Name": e.target.value }))}
            readOnly={!canEdit}
            className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#2d3748] mb-1">Email</label>
          <input
            type="email"
            value={form.Email ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, Email: e.target.value }))}
            readOnly={!canEdit}
            className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#2d3748] mb-1">Phone (read-only)</label>
          <input
            type="text"
            value={user?.["Phone Number"] ?? ""}
            readOnly
            className="w-full rounded-lg bg-[#f8f9fa] border border-[#e2e8f0] px-4 py-2.5 text-[#718096]"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="elite"
            checked={form.isEliteMember ?? false}
            onChange={(e) => setForm((f) => ({ ...f, isEliteMember: e.target.checked }))}
            disabled={!canEdit}
            className="rounded border-[#e2e8f0] text-[#4059ad] focus:ring-[#4059ad] disabled:opacity-50"
          />
          <label htmlFor="elite" className="text-[#2d3748] font-medium">Elite member</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#2d3748] mb-1">Referral count</label>
          <input
            type="number"
            min={0}
            value={form.ReferralCount ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, ReferralCount: parseInt(e.target.value, 10) || 0 }))}
            readOnly={!canEdit}
            className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#2d3748] mb-1">Referral points</label>
          <input
            type="number"
            min={0}
            value={form.ReferralPoints ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, ReferralPoints: parseInt(e.target.value, 10) || 0 }))}
            readOnly={!canEdit}
            className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
          />
        </div>
        {(canEdit || canDelete) && (
          <div className="flex gap-3 pt-4 border-t border-[#e2e8f0]">
            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-medium disabled:opacity-50 transition"
              >
                Delete user
              </button>
            )}
          </div>
        )}
      </form>
      </div>
    </div>
  );
}

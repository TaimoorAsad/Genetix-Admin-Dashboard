"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Coupon = {
  code: string;
  discountPercent: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function CouponsPage() {
  const { idToken, roleInfo } = useAuth();
  const canEdit = roleInfo?.role === "admin" || Boolean(roleInfo?.permissions?.canEditAppData);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newCode, setNewCode] = useState<string>("");
  const [newDiscountPercent, setNewDiscountPercent] = useState<string>("");
  const [newExpiresAt, setNewExpiresAt] = useState<string>("");

  const generateCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const length = 8;
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    setNewCode(out);
  };

  const loadCoupons = useCallback(() => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    fetch("/api/coupons", {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body.error as string) || `Failed to load coupons (${r.status})`);
        }
        return r.json();
      })
      .then((data: { coupons: Coupon[] }) => {
        setCoupons(data.coupons || []);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [idToken]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !canEdit) return;
    const discount = Number(newDiscountPercent);
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      setError("Discount percent must be between 1 and 100.");
      return;
    }
    const code = newCode.trim().toUpperCase();
    if (code && !/^[A-HJ-NP-Z2-9]{4,12}$/.test(code)) {
      setError("Invalid code. Use 4–12 chars: A–Z (excluding I/O) and 2–9.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: { code?: string; discountPercent: number; expiresAt?: string } = { discountPercent: discount };
      if (code) body.code = code;
      if (newExpiresAt.trim()) {
        body.expiresAt = newExpiresAt.trim();
      }
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const resp = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(resp.error || "Failed to create coupon");
      }
      setNewCode("");
      setNewDiscountPercent("");
      setNewExpiresAt("");
      loadCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    if (!idToken || !canEdit) return;
    try {
      const res = await fetch("/api/coupons", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code: coupon.code, active: !coupon.active }),
      });
      if (!res.ok) {
        const resp = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(resp.error || "Failed to update coupon");
      }
      loadCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update coupon");
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!idToken || !canEdit) return;
    if (!confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/coupons?code=${encodeURIComponent(coupon.code)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const resp = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(resp.error || "Failed to delete coupon");
      }
      loadCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete coupon");
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "No expiry";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Invalid date";
    return d.toLocaleString();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Coupons</h1>
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="mb-8 p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm max-w-xl">
        <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Create coupon</h2>
        <p className="text-sm text-[#718096] mb-4">
          Enter a custom code (recommended) or leave it empty to auto-generate. Discount is a percentage. Expiry is optional.
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#4a5568] mb-1">Coupon code (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  readOnly={!canEdit}
                  placeholder="e.g. EID25 (A–Z, 2–9)"
                  className="flex-1 rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:bg-[#f8f9fa] disabled:opacity-70 font-mono"
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={generateCode}
                    disabled={saving}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#4a5568] hover:bg-[#f8f9fa] disabled:opacity-50"
                  >
                    Generate
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-[#718096]">Allowed: 4–12 chars, A–Z (excluding I/O) and 2–9.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4a5568] mb-1">Discount (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={newDiscountPercent}
                onChange={(e) => setNewDiscountPercent(e.target.value)}
                required
                readOnly={!canEdit}
                className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:bg-[#f8f9fa] disabled:opacity-70"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4a5568] mb-1">Expiry (optional)</label>
              <input
                type="datetime-local"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                readOnly={!canEdit}
                className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:bg-[#f8f9fa] disabled:opacity-70"
              />
            </div>
          </div>
          {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
            >
              {saving ? "Creating..." : "Create coupon"}
            </button>
          )}
        </form>
      </section>

      <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
        <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Existing coupons</h2>
        {loading ? (
          <p className="text-sm text-[#718096]">Loading coupons…</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-[#718096]">No coupons yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className="text-left py-2 px-3 font-semibold text-[#4a5568]">Code</th>
                  <th className="text-left py-2 px-3 font-semibold text-[#4a5568]">Discount</th>
                  <th className="text-left py-2 px-3 font-semibold text-[#4a5568]">Expiry</th>
                  <th className="text-left py-2 px-3 font-semibold text-[#4a5568]">Status</th>
                  <th className="text-right py-2 px-3 font-semibold text-[#4a5568]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const now = new Date();
                  const expired = c.expiresAt ? new Date(c.expiresAt) < now : false;
                  const statusLabel = !c.active ? "Inactive" : expired ? "Expired" : "Active";
                  const statusColor = !c.active ? "text-red-600" : expired ? "text-amber-600" : "text-emerald-600";
                  return (
                    <tr key={c.code} className="border-b border-[#edf2f7]">
                      <td className="py-2 px-3 font-mono text-[#2d3748]">{c.code}</td>
                      <td className="py-2 px-3 text-[#2d3748]">{c.discountPercent}%</td>
                      <td className="py-2 px-3 text-[#4a5568]">{formatDate(c.expiresAt ?? null)}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                      </td>
                      <td className="py-2 px-3 text-right space-x-2">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleActive(c)}
                              className="inline-flex items-center px-2 py-1 rounded-md border border-[#e2e8f0] text-xs text-[#4a5568] hover:bg-[#f8f9fa]"
                            >
                              {c.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCoupon(c)}
                              className="inline-flex items-center px-2 py-1 rounded-md border border-red-200 text-xs text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


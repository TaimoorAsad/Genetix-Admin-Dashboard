"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Service = {
  id: string;
  name: string;
  description?: string;
  price: number;
  order: number;
};

export default function CounsellingPage() {
  const { idToken, roleInfo } = useAuth();
  const canEdit = roleInfo?.role === "admin" || Boolean(roleInfo?.permissions?.canEditAppData);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", description: "", price: "", order: "" });

  const load = useCallback(() => {
    if (!idToken) return;
    fetch("/api/counselling-services", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => setServices(data.services ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !canEdit) return;
    setError(null);
    setSavingId("new");
    try {
      const res = await fetch("/api/counselling-services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          name: addForm.name.trim(),
          description: addForm.description.trim() || undefined,
          price: addForm.price === "" ? 0 : Number(addForm.price),
          order: addForm.order === "" ? services.length : Number(addForm.order),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to create");
      }
      const created = await res.json();
      setServices((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setAddForm({ name: "", description: "", price: "", order: "" });
      setShowAdd(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Service>) => {
    if (!idToken || !canEdit) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`/api/counselling-services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to update");
      }
      const updated = await res.json();
      setServices((prev) =>
        prev.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.order - b.order)
      );
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!idToken || !canEdit || !confirm("Delete this service?")) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`/api/counselling-services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to delete");
      }
      setServices((prev) => prev.filter((s) => s.id !== id));
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Counselling services</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-2">Counselling services</h1>
      <p className="text-[#718096] text-sm mb-6">
        Manage the services shown in the counselling section of the mobile app. Set name, description, price, and order.
        The app reads from Firestore collection <code className="bg-[#e2e8f0] px-1 rounded">counsellingServices</code> (fields: name, description, price, order). The first 4 services by order map to the app payment types in order: Report, Report &amp; Counselling, Graphology, Numerology.
      </p>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm overflow-hidden">
        {canEdit && (
          <div className="p-4 border-b border-[#e2e8f0] bg-[#f8f9fa]">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium transition"
            >
              Add service
            </button>
          </div>
        )}

        {showAdd && (
          <form
            onSubmit={handleCreate}
            className="p-6 border-b border-[#e2e8f0] bg-[#f8f9fa] space-y-4"
          >
            <h2 className="text-lg font-semibold text-[#2d3748]">New service</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2d3748] mb-1">Name *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                  placeholder="Service name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2d3748] mb-1">Price</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={addForm.price}
                  onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1">Description</label>
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingId === "new"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50"
              >
                {savingId === "new" ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddForm({ name: "", description: "", price: "", order: "" });
                }}
                className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#718096] text-sm hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f8f9fa] text-[#718096] font-medium border-b border-[#e2e8f0]">
              <tr>
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Price</th>
                {canEdit && <th className="px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-[#2d3748]">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-6 py-8 text-center text-[#718096]">
                    No counselling services yet. {canEdit && "Click Add service to create one."}
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fa]">
                    <td className="px-6 py-4">{s.order}</td>
                    <td className="px-6 py-4 font-medium">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          defaultValue={s.name}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== s.name) handleUpdate(s.id, { name: v });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full rounded border border-[#e2e8f0] px-2 py-1"
                        />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="px-6 py-4 text-[#718096] max-w-xs truncate">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          defaultValue={s.description ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (s.description ?? "")) handleUpdate(s.id, { description: v || undefined });
                          }}
                          placeholder="Description"
                          className="w-full rounded border border-[#e2e8f0] px-2 py-1"
                        />
                      ) : (
                        s.description ?? "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === s.id ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={s.price}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== s.price) handleUpdate(s.id, { price: v });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className="w-24 rounded border border-[#e2e8f0] px-2 py-1"
                        />
                      ) : (
                        s.price
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        {editingId === s.id ? (
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-[#718096] hover:text-[#2d3748] text-sm"
                          >
                            Done
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(s.id)}
                              disabled={savingId !== null}
                              className="text-[#4059ad] hover:underline text-sm mr-3 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s.id)}
                              disabled={savingId !== null}
                              className="text-red-600 hover:underline text-sm disabled:opacity-50"
                            >
                              {savingId === s.id ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

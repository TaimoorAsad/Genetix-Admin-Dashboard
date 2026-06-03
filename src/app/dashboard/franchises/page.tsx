"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Franchise = {
  id: string;
  number?: string;
  name?: string;
  email?: string;
  phone?: string;
  canEditFranchiseUsers?: boolean;
  canDeleteFranchiseUsers?: boolean;
  [key: string]: unknown;
};

type EditForm = {
  number: string;
  name: string;
  email: string;
  phone: string;
  canEditFranchiseUsers: boolean;
  canDeleteFranchiseUsers: boolean;
};

export default function FranchisesPage() {
  const { idToken, roleInfo } = useAuth();
  const isAdmin = roleInfo?.role === "admin";
  const canEdit = isAdmin || Boolean(roleInfo?.permissions?.canEditFranchises);
  const canDelete = isAdmin || Boolean(roleInfo?.permissions?.canDeleteFranchises);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    number: "",
    name: "",
    email: "",
    phone: "",
    canEditFranchiseUsers: false,
    canDeleteFranchiseUsers: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    number: "",
    name: "",
    email: "",
    phone: "",
    canEditFranchiseUsers: false,
    canDeleteFranchiseUsers: false,
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleCreateFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    if (!addForm.number.trim()) {
      setAddError("Number / Referral code is required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/franchises", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          number: addForm.number.trim(),
          name: addForm.name.trim(),
          email: addForm.email.trim() || null,
          phone: addForm.phone.trim() || null,
          canEditFranchiseUsers: addForm.canEditFranchiseUsers,
          canDeleteFranchiseUsers: addForm.canDeleteFranchiseUsers,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Creation failed");
      }
      setAddForm({
        number: "",
        name: "",
        email: "",
        phone: "",
        canEditFranchiseUsers: false,
        canDeleteFranchiseUsers: false,
      });
      setShowAddModal(false);
      load();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setAddSaving(false);
    }
  };

  const load = useCallback(() => {
    if (!idToken) return;
    fetch("/api/franchises", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => setFranchises(data.franchises || []))
      .catch(() => setError("Failed to load franchises"))
      .finally(() => setLoading(false));
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (f: Franchise) => {
    setEditingId(f.id);
    setEditForm({
      number: String(f.number ?? ""),
      name: String(f.name ?? ""),
      email: String(f.email ?? ""),
      phone: String(f.phone ?? ""),
      canEditFranchiseUsers: Boolean(f.canEditFranchiseUsers),
      canDeleteFranchiseUsers: Boolean(f.canDeleteFranchiseUsers),
    });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async (id: string) => {
    if (!idToken) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/franchises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          number: editForm.number.trim(),
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          canEditFranchiseUsers: editForm.canEditFranchiseUsers,
          canDeleteFranchiseUsers: editForm.canDeleteFranchiseUsers,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Update failed");
      }
      setEditingId(null);
      load();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!idToken || !confirm("Delete this franchise?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/franchises/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls = "w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-1.5 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none";

  if (loading && franchises.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Franchises</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 dashboard-page-header">
        <h1 className="text-3xl font-bold text-[#2d3748]">Franchises</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Franchise
          </button>
        )}
      </div>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}
      <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] overflow-hidden">
        <div className="w-full overflow-x-auto dashboard-table-scroll">
          <table className="w-full text-left min-w-[560px]">
            <thead className="bg-[#f8f9fa] border-b border-[#e2e8f0]">
              <tr>
                <th className="px-6 py-4 font-semibold text-[#2d3748] text-sm">Number / Referral code</th>
                <th className="px-6 py-4 font-semibold text-[#2d3748] text-sm">Name</th>
                <th className="px-6 py-4 font-semibold text-[#2d3748] text-sm">Email</th>
                <th className="px-6 py-4 font-semibold text-[#2d3748] text-sm whitespace-nowrap">Franchise may edit users</th>
                <th className="px-6 py-4 font-semibold text-[#2d3748] text-sm whitespace-nowrap">Franchise may delete users</th>
                <th className="px-6 py-4 font-semibold text-[#2d3748] text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {franchises.map((f) => (
                <Fragment key={f.id}>
                  <tr className="bg-white hover:bg-[#f8f9fa] transition">
                    <td className="px-6 py-4 text-[#2d3748] font-mono font-medium">{f.number ?? "—"}</td>
                    <td className="px-6 py-4 text-[#718096]">{f.name ?? "—"}</td>
                    <td className="px-6 py-4 text-[#718096] text-sm">{(f.email as string) || "—"}</td>
                    <td className="px-6 py-4 text-[#718096] text-sm">{f.canEditFranchiseUsers ? "Yes" : "No"}</td>
                    <td className="px-6 py-4 text-[#718096] text-sm">{f.canDeleteFranchiseUsers ? "Yes" : "No"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {canEdit && editingId !== f.id && (
                          <button
                            onClick={() => startEdit(f)}
                            className="text-[#4059ad] hover:text-[#344a8a] text-sm font-medium"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(f.id)}
                            disabled={deletingId === f.id}
                            className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                          >
                            {deletingId === f.id ? "Deleting…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === f.id && (
                    <tr key={`${f.id}-edit`} className="bg-[#f8faff] border-t border-[#4059ad]/20">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="max-w-2xl space-y-3">
                          <p className="text-xs font-semibold text-[#4059ad] uppercase tracking-wide mb-2">Edit franchise</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[#718096] mb-1">Number / Referral code</label>
                              <input
                                type="text"
                                value={editForm.number}
                                onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                                className={inputCls}
                                placeholder="+923001234567"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#718096] mb-1">Franchise name</label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                className={inputCls}
                                placeholder="Franchise name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#718096] mb-1">Email</label>
                              <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                className={inputCls}
                                placeholder="owner@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#718096] mb-1">Phone</label>
                              <input
                                type="tel"
                                value={editForm.phone}
                                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                className={inputCls}
                                placeholder="+923001234567"
                              />
                            </div>
                            <div className="col-span-2 flex flex-wrap gap-6 pt-1">
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2d3748]">
                                <input
                                  type="checkbox"
                                  checked={editForm.canEditFranchiseUsers}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, canEditFranchiseUsers: e.target.checked }))
                                  }
                                  className="rounded border-[#cbd5e0] text-[#4059ad] focus:ring-[#4059ad]/30"
                                />
                                Allow franchise login to edit users linked to this franchise
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2d3748]">
                                <input
                                  type="checkbox"
                                  checked={editForm.canDeleteFranchiseUsers}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, canDeleteFranchiseUsers: e.target.checked }))
                                  }
                                  className="rounded border-[#cbd5e0] text-[#4059ad] focus:ring-[#4059ad]/30"
                                />
                                Allow franchise login to delete users linked to this franchise
                              </label>
                            </div>
                          </div>
                          {saveError && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleSave(f.id)}
                              disabled={saving}
                              className="px-4 py-1.5 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 transition"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="px-4 py-1.5 rounded-lg border border-[#e2e8f0] text-[#718096] text-sm font-medium hover:bg-[#f8f9fa] disabled:opacity-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {franchises.length === 0 && !loading && (
          <div className="p-12 text-center">
            <p className="text-[#718096]">No franchises yet.</p>
          </div>
        )}
      </div>
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && !addSaving && setShowAddModal(false)}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#e2e8f0] p-6">
            <h3 className="text-lg font-semibold text-[#2d3748] mb-4">Add new franchise</h3>
            {addError && (
              <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{addError}</p>
            )}
            <form onSubmit={handleCreateFranchise} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Number / Referral code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +923001234567"
                  className={inputCls}
                  value={addForm.number}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Franchise name</label>
                <input
                  type="text"
                  placeholder="e.g. Lahore Branch"
                  className={inputCls}
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. owner@example.com"
                  className={inputCls}
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="e.g. +923001234567"
                  className={inputCls}
                  value={addForm.phone}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2d3748]">
                  <input
                    type="checkbox"
                    checked={addForm.canEditFranchiseUsers}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, canEditFranchiseUsers: e.target.checked }))
                    }
                    className="rounded border-[#cbd5e0] text-[#4059ad] focus:ring-[#4059ad]/30"
                  />
                  Allow franchise login to edit users linked to this franchise
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2d3748]">
                  <input
                    type="checkbox"
                    checked={addForm.canDeleteFranchiseUsers}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, canDeleteFranchiseUsers: e.target.checked }))
                    }
                    className="rounded border-[#cbd5e0] text-[#4059ad] focus:ring-[#4059ad]/30"
                  />
                  Allow franchise login to delete users linked to this franchise
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addSaving}
                  className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#718096] text-sm font-medium hover:bg-[#f8f9fa] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
                >
                  {addSaving ? "Creating…" : "Create Franchise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

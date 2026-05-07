"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type ReferredUser = { uid: string; name: string; email: string; phone: string; registeredOn: string };
type Franchise = {
  id: string;
  number?: string;
  name?: string;
  referralCount?: number;
  referredUsers?: ReferredUser[];
  canEditFranchiseUsers?: boolean;
  canDeleteFranchiseUsers?: boolean;
  [key: string]: unknown;
};

const inputCls =
  "w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-1.5 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none";

export default function MyFranchisePage() {
  const { idToken, roleInfo, loading, roleLoading } = useAuth();
  const router = useRouter();
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editUid, setEditUid] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    "Full Name": "",
    Email: "",
    "Phone Number": "",
    Gender: "",
    Education: "",
    "Father's Name": "",
    "Mother's Name": "",
    "Place of Birth": "",
    "Date of Birth": "",
    "Time of Birth": "",
    "Profile Url": "",
  });
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [editFetching, setEditFetching] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const loadFranchise = useCallback(() => {
    if (!idToken || roleInfo?.role !== "franchise") return;
    setError(null);
    fetch("/api/me/franchise", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load franchise");
        return r.json();
      })
      .then(setFranchise)
      .catch((e: Error) => setError(e.message));
  }, [idToken, roleInfo?.role]);

  useEffect(() => {
    if (roleInfo?.role !== "franchise" && !loading && !roleLoading) {
      router.replace("/dashboard");
      return;
    }
  }, [roleInfo, loading, roleLoading, router]);

  useEffect(() => {
    loadFranchise();
  }, [loadFranchise]);

  useEffect(() => {
    if (!editUid || !idToken) return;
    setEditLoadError(null);
    setEditSaveError(null);
    setEditFetching(true);
    setEditForm({
      "Full Name": "",
      Email: "",
      "Phone Number": "",
      Gender: "",
      Education: "",
      "Father's Name": "",
      "Mother's Name": "",
      "Place of Birth": "",
      "Date of Birth": "",
      "Time of Birth": "",
      "Profile Url": "",
    });
    fetch(`/api/users/${editUid}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load user");
        return r.json();
      })
      .then((data: Record<string, unknown>) => {
        setEditForm({
          "Full Name": String(data["Full Name"] ?? ""),
          Email: String(data.Email ?? ""),
          "Phone Number": String(data["Phone Number"] ?? ""),
          Gender: String(data.Gender ?? ""),
          Education: String(data.Education ?? ""),
          "Father's Name": String(data["Father's Name"] ?? ""),
          "Mother's Name": String(data["Mother's Name"] ?? ""),
          "Place of Birth": String(data["Place of Birth"] ?? ""),
          "Date of Birth": String(data["Date of Birth"] ?? ""),
          "Time of Birth": String(data["Time of Birth"] ?? ""),
          "Profile Url": String(data["Profile Url"] ?? ""),
        });
      })
      .catch(() => setEditLoadError("Could not load user details."))
      .finally(() => setEditFetching(false));
  }, [editUid, idToken]);

  const closeEdit = () => {
    setEditUid(null);
    setEditLoadError(null);
    setEditSaveError(null);
    setEditFetching(false);
  };

  const saveEdit = async () => {
    if (!idToken || !editUid) return;
    setEditSaving(true);
    setEditSaveError(null);
    try {
      const res = await fetch(`/api/users/${editUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error || "Save failed");
      }
      closeEdit();
      loadFranchise();
    } catch (e: unknown) {
      setEditSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteUser = async (uid: string) => {
    if (!idToken) return;
    if (!confirm("Delete this user permanently? Their app account and fingerprint data will be removed.")) return;
    setDeletingUid(uid);
    setError(null);
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error || "Delete failed");
      }
      loadFranchise();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingUid(null);
    }
  };

  if (roleInfo?.role !== "franchise") return null;

  const canEdit = Boolean(franchise?.canEditFranchiseUsers);
  const canDelete = Boolean(franchise?.canDeleteFranchiseUsers);
  const showActions = canEdit || canDelete;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-6">My franchise</h1>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">{error}</div>
      )}
      {franchise && (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#2d3748] mb-4">Franchise details</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[#718096] font-medium mb-1">Referral / Franchise number</dt>
                <dd className="text-[#2d3748] font-mono text-lg font-semibold">{franchise.number ?? franchise.id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[#718096] font-medium mb-1">Name</dt>
                <dd className="text-[#2d3748]">{String(franchise.name ?? "—")}</dd>
              </div>
            </dl>
            {(canEdit || canDelete) && (
              <p className="mt-4 text-xs text-[#718096]">
                Your dashboard can {canEdit ? "edit" : ""}
                {canEdit && canDelete ? " and " : ""}
                {canDelete ? "delete" : ""} users linked to your franchise, as enabled by an administrator.
              </p>
            )}
            <div className="mt-4 p-3 bg-[#f8f9fa] rounded-lg border border-[#e2e8f0]">
              <p className="text-[#718096] text-sm">
                Share your phone number (<span className="font-mono font-semibold text-[#2d3748]">{franchise.number ?? "—"}</span>) as your referral code. Users who enter it during signup will be linked to your franchise.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#2d3748]">Referrals</h2>
              <span className="px-3 py-1 rounded-full bg-[#4059ad]/10 text-[#4059ad] text-sm font-semibold">
                {franchise.referralCount ?? 0} total
              </span>
            </div>

            {(franchise.referredUsers?.length ?? 0) === 0 ? (
              <p className="text-[#a0aec0] text-sm">No users have used your referral code yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] text-[#718096] text-xs">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Phone</th>
                      <th className="py-2 pr-4 font-medium">Email</th>
                      {showActions && <th className="py-2 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {franchise.referredUsers!.map((u) => (
                      <tr key={u.uid} className="hover:bg-[#f8f9fa]">
                        <td className="py-2 pr-4 text-[#2d3748] font-medium">{u.name || "—"}</td>
                        <td className="py-2 pr-4 text-[#718096] font-mono">{u.phone || "—"}</td>
                        <td className="py-2 pr-4 text-[#718096] truncate max-w-[200px]">{u.email || "—"}</td>
                        {showActions && (
                          <td className="py-2 text-right whitespace-nowrap">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setEditUid(u.uid)}
                                className="text-[#4059ad] hover:text-[#344a8a] text-xs font-medium mr-3"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteUser(u.uid)}
                                disabled={deletingUid === u.uid}
                                className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                              >
                                {deletingUid === u.uid ? "Deleting…" : "Delete"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {editUid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && !editSaving && closeEdit()}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#e2e8f0] p-6">
            <h3 className="text-lg font-semibold text-[#2d3748] mb-4">Edit user</h3>
            {editLoadError && (
              <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editLoadError}</p>
            )}
            {editSaveError && (
              <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editSaveError}</p>
            )}
            {editFetching && <p className="text-sm text-[#718096] mb-3">Loading user…</p>}
            <div className="space-y-3">
              {(
                [
                  ["Full Name", "Full Name"],
                  ["Email", "Email"],
                  ["Phone Number", "Phone Number"],
                  ["Gender", "Gender"],
                  ["Education", "Education"],
                  ["Father's Name", "Father's Name"],
                  ["Mother's Name", "Mother's Name"],
                  ["Place of Birth", "Place of Birth"],
                  ["Date of Birth", "Date of Birth"],
                  ["Time of Birth", "Time of Birth"],
                  ["Profile Url", "Profile image URL"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-[#718096] mb-1">{label}</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={editForm[key as keyof typeof editForm]}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    disabled={editFetching || Boolean(editLoadError)}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#718096] text-sm font-medium hover:bg-[#f8f9fa] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving || editFetching || Boolean(editLoadError)}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { STAFF_PERMISSION_KEYS, DEFAULT_STAFF_PERMISSIONS } from "@/lib/dashboard-roles";
import type { StaffPermissionKey } from "@/lib/dashboard-roles";

type RoleDoc = {
  uid: string;
  role: string;
  email?: string;
  permissions?: Record<string, boolean>;
};

const PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  canViewStats: "View overview / stats",
  canViewUsers: "View users list",
  canEditUsers: "Edit users",
  canDeleteUsers: "Delete users",
  canViewFranchises: "View franchises",
  canEditFranchises: "Edit / add franchises",
  canDeleteFranchises: "Delete franchises",
  canViewAppData: "View app data & content (App Data tab, Counselling, Testimonials, Points & Usage, About Us, Coupons)",
  canEditAppData: "Edit app data & content (App Data tab settings, Counselling services, Testimonials, Points & Usage, About Us, Coupons, chatbot & messages)",
};

export default function PermissionsPage() {
  const { idToken, roleInfo, loading, roleLoading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; [key: string]: unknown }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    if (roleInfo?.role !== "admin" && !loading && !roleLoading) {
      router.replace("/dashboard");
      return;
    }
  }, [roleInfo, loading, roleLoading, router]);

  const load = useCallback(() => {
    if (!idToken || roleInfo?.role !== "admin") return;
    fetch("/api/dashboard-roles", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        setRoles(data.roles || []);
        setLocalPermissions({});
      })
      .catch(() => setError("Failed to load staff"));
  }, [idToken, roleInfo?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePermissions = async (uid: string, permissions: Record<string, boolean>) => {
    if (!idToken) return;
    setSaving(uid);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard-roles/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed");
      }
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  const togglePermission = (uid: string, key: StaffPermissionKey, value: boolean) => {
    setLocalPermissions((prev) => {
      const current = prev[uid] || {};
      return {
        ...prev,
        [uid]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const handleSavePermissions = async (role: RoleDoc) => {
    const localPerms = localPermissions[role.uid];
    if (!localPerms) return;
    
    const mergedPermissions = {
      ...(role.permissions ?? DEFAULT_STAFF_PERMISSIONS),
      ...localPerms,
    };
    
    await updatePermissions(role.uid, mergedPermissions);
    setLocalPermissions((prev) => {
      const next = { ...prev };
      delete next[role.uid];
      return next;
    });
  };

  const getEffectivePermissions = (role: RoleDoc): Record<string, boolean> => {
    const localPerms = localPermissions[role.uid];
    if (localPerms) {
      return {
        ...(role.permissions ?? DEFAULT_STAFF_PERMISSIONS),
        ...localPerms,
      };
    }
    return role.permissions ?? DEFAULT_STAFF_PERMISSIONS;
  };

  const hasUnsavedChanges = (role: RoleDoc): boolean => {
    return Boolean(localPermissions[role.uid]);
  };

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !search.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(search.trim())}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to search users");
      }
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleAddStaff = async (user: { id: string; [key: string]: unknown }) => {
    if (!idToken) return;
    setAddingUid(user.id);
    setError(null);
    try {
      const res = await fetch("/api/dashboard-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          role: "staff",
          uid: user.id,
          email: user.Email || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to add staff");
      }
      await res.json();
      setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add staff");
    } finally {
      setAddingUid(null);
    }
  };

  if (roleInfo?.role !== "admin") return null;

  const staffRoles = roles.filter((r) => r.role === "staff");

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-4">Staff permissions</h1>
      <p className="text-[#718096] text-sm mb-6">
        Control what each staff member can do. Staff can only perform actions you enable here.
      </p>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}
      <section className="mb-8 rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#2d3748] mb-3">Add staff member</h2>
        <p className="text-[#718096] text-sm mb-4">
          Search existing users by name, email, or phone and add them as staff. Make sure they have a Firebase Auth account.
        </p>
        <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="flex-1 rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
          />
          <button
            type="submit"
            disabled={searching || !search.trim()}
            className="px-4 py-2.5 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="border border-[#e2e8f0] rounded-lg divide-y divide-[#e2e8f0] max-h-80 overflow-y-auto">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#2d3748] truncate">{String(u["Full Name"] ?? "").trim() || "Unnamed user"}</p>
                  <p className="text-xs text-[#718096] truncate">
                    {String(u.Email ?? "").trim() || "No email"} • {String(u["Phone Number"] ?? "").trim() || "No phone"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddStaff(u)}
                  disabled={addingUid === u.id}
                  className="ml-4 px-3 py-1.5 rounded-lg bg-[#97d8c4] hover:bg-[#7fc9b3] text-white text-xs font-medium disabled:opacity-50 transition"
                >
                  {addingUid === u.id ? "Adding..." : "Make staff"}
                </button>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && !searching && (
          <p className="text-xs text-[#a0aec0]">No users loaded. Search above to find users to add as staff.</p>
        )}
      </section>
      {staffRoles.length === 0 ? (
        <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6 text-[#718096]">
          No staff accounts yet. Use the form above to search for existing users and add them as staff.
        </div>
      ) : (
        <div className="space-y-4">
          {staffRoles.map((role) => (
            <div
              key={role.uid}
              className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-[#2d3748]">{role.email || role.uid}</p>
                  <p className="text-xs text-[#a0aec0] mt-1">{role.uid}</p>
                </div>
                <div className="flex items-center gap-3">
                  {hasUnsavedChanges(role) && (
                    <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
                  )}
                  {saving === role.uid ? (
                    <span className="text-[#718096] text-sm">Saving...</span>
                  ) : (
                    hasUnsavedChanges(role) && (
                      <button
                        onClick={() => handleSavePermissions(role)}
                        disabled={saving === role.uid}
                        className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
                      >
                        Save Changes
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STAFF_PERMISSION_KEYS.map((key) => {
                  const effectivePerms = getEffectivePermissions(role);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-[#2d3748] cursor-pointer hover:bg-[#f8f9fa] p-2 rounded transition"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(effectivePerms[key] ?? DEFAULT_STAFF_PERMISSIONS[key])}
                        onChange={(e) => togglePermission(role.uid, key, e.target.checked)}
                        disabled={saving === role.uid}
                        className="rounded border-[#e2e8f0] text-[#4059ad] focus:ring-[#4059ad] disabled:opacity-50"
                      />
                      {PERMISSION_LABELS[key]}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

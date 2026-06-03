"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type ImageStatus = "all" | "none" | "partial";

type UserRow = {
  id: string;
  "Full Name"?: string;
  "Phone Number"?: string;
  Email?: string;
  "Registered On"?: string;
  isEliteMember?: boolean;
  ReferralCount?: number;
  ReferralCode?: string;
  Franchise?: string;
  LoginCount?: number;
  imageStatus?: ImageStatus;
};

type FranchiseRow = { id: string; number?: string; name?: string };

function buildFranchiseNameByNumber(franchises: FranchiseRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of franchises) {
    const num = String(f.number ?? "").trim();
    const name = String(f.name ?? "").trim();
    if (!num) continue;
    const displayName = name || num;
    const variants = new Set<string>([num, num.replace(/\s+/g, "")]);
    if (num.startsWith("+")) variants.add(num.slice(1));
    else variants.add(`+${num}`);
    variants.forEach((v) => {
      if (v) m.set(v, displayName);
    });
  }
  return m;
}

/** If referral/franchise code matches a franchise number → franchise name; otherwise show the referral code (or linked franchise number). */
function franchiseReferralDisplay(
  u: UserRow,
  nameByNumber: Map<string, string>
): { text: string; title: string } {
  const refCode = String(u.ReferralCode ?? "").trim();
  const franchiseNum = String(u.Franchise ?? "").trim();
  const lookup = (code: string) =>
    nameByNumber.get(code) ?? nameByNumber.get(code.replace(/\s+/g, ""));

  if (refCode) {
    const franchiseName = lookup(refCode);
    if (franchiseName) {
      return { text: franchiseName, title: `${franchiseName} (${refCode})` };
    }
    return { text: refCode, title: refCode };
  }
  if (franchiseNum) {
    const franchiseName = lookup(franchiseNum);
    if (franchiseName) {
      return { text: franchiseName, title: `${franchiseName} (${franchiseNum})` };
    }
    return { text: franchiseNum, title: franchiseNum };
  }
  return { text: "—", title: "" };
}

function UserStatusBadge({ status }: { status: ImageStatus }) {
  if (status === "all") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
        All
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4059ad] shrink-0"></span>
        Part
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
      None
    </span>
  );
}

const SEARCH_DEBOUNCE_MS = 350;

type PageSize = "all" | "50" | "100" | "500";

export default function UsersPage() {
  const { idToken, roleInfo } = useAuth();
  const isAdmin = roleInfo?.role === "admin";
  const canDelete = isAdmin || Boolean(roleInfo?.permissions?.canDeleteUsers);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFilter, setImageFilter] = useState<ImageStatus | "all-users">("all-users");
  const [pageSize, setPageSize] = useState<PageSize>("50");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [franchiseNameByNumber, setFranchiseNameByNumber] = useState<Map<string, string>>(() => new Map());

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    isEliteMember: false,
    referralCode: "",
    franchise: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleExportExcel = async () => {
    if (!idToken) return;
    try {
      const res = await fetch("/api/users?limit=all", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch all users data");
      const data = await res.json();
      const allUsers = data.users || [];
      if (allUsers.length === 0) {
        alert("No users data to export");
        return;
      }

      const headers = [
        "User ID",
        "Full Name",
        "Phone Number",
        "Email",
        "Registered On",
        "Elite Member",
        "Referral Count",
        "Referral Points",
        "Referral Code",
        "Franchise",
        "Login Count",
        "Image Status",
        "Father's Name",
        "Mother's Name",
        "Gender",
        "Education",
        "Place of Birth",
        "Date of Birth",
        "Time of Birth",
        "Report Normal",
        "Report Premium",
        "Numerology Course",
        "Graphology Course",
        "Learn And Earn",
        "Referral Paid",
        "Submitted",
      ];

      const csvRows = [headers.join(",")];

      const escapeCSV = (val: unknown) => {
        if (val === undefined || val === null) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      for (const u of allUsers) {
        const row = [
          escapeCSV(u.id),
          escapeCSV(u["Full Name"]),
          escapeCSV(u["Phone Number"]),
          escapeCSV(u.Email),
          escapeCSV(u["Registered On"]),
          escapeCSV(u.isEliteMember ? "Yes" : "No"),
          escapeCSV(u.ReferralCount),
          escapeCSV(u.ReferralPoints),
          escapeCSV(u.ReferralCode),
          escapeCSV(u.Franchise),
          escapeCSV(u.LoginCount),
          escapeCSV(u.imageStatus),
          escapeCSV(u["Father's Name"]),
          escapeCSV(u["Mother's Name"]),
          escapeCSV(u["Gender"]),
          escapeCSV(u["Education"]),
          escapeCSV(u["Place of Birth"]),
          escapeCSV(u["Date of Birth"]),
          escapeCSV(u["Time of Birth"]),
          escapeCSV(u.ReportNormal ? "Yes" : "No"),
          escapeCSV(u.ReportPremium ? "Yes" : "No"),
          escapeCSV(u.NumerologyCourse ? "Yes" : "No"),
          escapeCSV(u.GraphologyCourse ? "Yes" : "No"),
          escapeCSV(u.LearnAndEarn ? "Yes" : "No"),
          escapeCSV(u.ReferralPaid ? "Yes" : "No"),
          escapeCSV(u.isSubmitted ? "Yes" : "No"),
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = "\ufeff" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `users_export_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    if (!addForm.email.trim() && !addForm.phoneNumber.trim()) {
      setAddError("At least Email or Phone Number is required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          "Full Name": addForm.fullName.trim(),
          Email: addForm.email.trim() || null,
          "Phone Number": addForm.phoneNumber.trim() || null,
          isEliteMember: addForm.isEliteMember,
          ReferralCode: addForm.referralCode.trim(),
          Franchise: addForm.franchise.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create user");
      }
      setAddForm({
        fullName: "",
        email: "",
        phoneNumber: "",
        isEliteMember: false,
        referralCode: "",
        franchise: "",
      });
      setShowAddModal(false);
      await load(currentPage);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!idToken) return;
    if (!confirm("Delete this user? This will remove Firestore data and Auth account. This cannot be undone.")) return;
    setError(null);
    try {
      const res = await fetch("/api/users/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status})`);
      }
      if (!searchQuery.trim()) {
        await load(currentPage);
      } else {
        setSearchQuery("");
        await load(1);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const displayUsers = searchResults !== null ? searchResults : users;

  useEffect(() => {
    if (!idToken) return;
    fetch("/api/franchises", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { franchises?: FranchiseRow[] }) => {
        setFranchiseNameByNumber(buildFranchiseNameByNumber(data.franchises ?? []));
      })
      .catch(() => setFranchiseNameByNumber(new Map()));
  }, [idToken]);

  const load = useCallback(async (page: number) => {
    if (!idToken) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", pageSize);
    if (imageFilter !== "all-users") params.set("imageStatus", imageFilter);
    const url = `/api/users?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body.error as string) || `Failed to load users (${res.status})`;
      setError(msg);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users || []);
    setSelectedIds(new Set());
    setCurrentPage(data.page || page);
    setTotalPages(data.totalPages || 1);
    setTotalUsers(data.totalUsers || 0);
    setLoading(false);
  }, [idToken, imageFilter, pageSize]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      load(currentPage);
    }
  }, [load, currentPage, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setCurrentPage(1);
    }
  }, [imageFilter, searchQuery, pageSize]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      if (!idToken) return;
      setSearchLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/users?search=${encodeURIComponent(term)}`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSearchResults([]);
          setError((body.error as string) || `Search failed (${res.status})`);
        } else {
          const data = await res.json();
          setSearchResults((data.users as UserRow[]) || []);
        }
      } catch {
        setSearchResults([]);
        setError("Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, idToken]);

  const handleBulkDelete = async () => {
    if (!idToken || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} user(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body.error as string) || `Delete failed (${res.status})`);
      }
      setSelectedIds(new Set());
      if (!searchQuery.trim()) {
        await load(currentPage);
      } else {
        setSearchQuery("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Users</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 dashboard-page-header">
        <h1 className="text-3xl font-bold text-[#2d3748]">Users</h1>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-lg bg-white border border-[#e2e8f0] hover:bg-[#f8f9fa] text-[#4a5568] text-sm font-medium shadow-sm transition w-full md:w-auto flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4 text-[#718096]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium shadow-sm transition w-full md:w-auto flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition w-full md:w-auto"
            >
              {bulkDeleting ? "Deleting…" : `Delete selected (${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <p>{error}</p>
          {error.includes("Unauthorized") && (
            <p className="mt-2 text-red-700">Add your sign-in email to ADMIN_EMAILS (or your UID to ADMIN_UIDS) in .env.local and restart the dev server.</p>
          )}
          {(error.includes("FIREBASE_SERVICE_ACCOUNT") || error.includes("invalid") || error.includes("JSON")) && (
            <p className="mt-2 text-red-700">Fix FIREBASE_SERVICE_ACCOUNT_JSON in .env.local: paste the full service account JSON on one line (no truncation with ...). Restart the dev server.</p>
          )}
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-4 md:p-6 mb-6 dashboard-card-panel">
        <div className="flex flex-wrap gap-4 items-center mb-4 dashboard-filters">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="flex-1 min-w-0 md:min-w-[200px] md:max-w-md rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
            aria-label="Search users"
          />
          <select
            value={imageFilter}
            onChange={(e) => {
              const newFilter = e.target.value as ImageStatus | "all-users";
              setImageFilter(newFilter);
              if (currentPage !== 1) {
                setCurrentPage(1);
              }
            }}
            className="w-full md:w-auto px-4 py-2.5 rounded-lg bg-white border border-[#e2e8f0] text-[#2d3748] text-sm focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none md:min-w-[180px]"
          >
            <option value="all-users">All Users</option>
            <option value="all">All Images (Green)</option>
            <option value="partial">Partial (Blue)</option>
            <option value="none">No Images (Red)</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(e.target.value as PageSize);
              if (currentPage !== 1) {
                setCurrentPage(1);
              }
            }}
            className="w-full md:w-auto px-4 py-2.5 rounded-lg bg-white border border-[#e2e8f0] text-[#2d3748] text-sm focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none md:min-w-[160px]"
            aria-label="Users per page"
          >
            <option value="all">Show all</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
            <option value="500">500 per page</option>
          </select>
        </div>
        {searchQuery.trim() && (
          <p className="text-sm text-[#718096]">
            {searchLoading ? "Searching all users…" : `Found ${displayUsers.length} user(s)`}
          </p>
        )}
        {!searchQuery.trim() && (
          <p className="text-sm text-[#718096]">
            {pageSize === "all" ? (
              <>Showing all {displayUsers.length} of {totalUsers} user(s) • Sorted by date (newest first)</>
            ) : (
              <>Page {currentPage} of {totalPages} • Showing {displayUsers.length} of {totalUsers} user(s) • Sorted by date (newest first)</>
            )}
            {imageFilter !== "all-users" && ` (${imageFilter === "all" ? "all images uploaded" : imageFilter === "partial" ? "partial images uploaded" : "no images uploaded"})`}
          </p>
        )}
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] overflow-hidden">
        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-[#e2e8f0]">
          {displayUsers.map((u) => {
            const status = u.imageStatus || "none";
            const borderColor =
              status === "all" ? "border-l-[#10b981]" : status === "partial" ? "border-l-[#4059ad]" : "border-l-[#ef4444]";
            const franchiseRef = franchiseReferralDisplay(u, franchiseNameByNumber);
            return (
              <div key={u.id} className={`p-4 border-l-4 ${borderColor} bg-white`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mt-1 shrink-0"
                    aria-label={`Select ${String(u["Full Name"] ?? "user")}`}
                    checked={selectedIds.has(u.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(u.id);
                        else next.delete(u.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-[#2d3748] text-sm truncate">{u["Full Name"] ?? "—"}</p>
                      <UserStatusBadge status={status} />
                    </div>
                    {u["Phone Number"] && (
                      <p className="text-sm text-[#718096] truncate">{u["Phone Number"]}</p>
                    )}
                    {u.Email && (
                      <p className="text-sm text-[#718096] truncate">{u.Email}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#718096]">
                      <span>Refs: {u.ReferralCount ?? 0}</span>
                      <span>Logins: {u.LoginCount ?? 0}</span>
                      <span>{u.isEliteMember ? "Elite" : "Standard"}</span>
                      {u["Registered On"] && (
                        <span>
                          {new Date(u["Registered On"]).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    {franchiseRef.text !== "—" && (
                      <p className="mt-1 text-xs text-[#718096] truncate" title={franchiseRef.title || franchiseRef.text}>
                        {franchiseRef.text}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <Link
                        href={`/dashboard/users/${u.id}/fingerprints`}
                        className="text-[#4059ad] hover:text-[#344a8a] text-sm font-medium py-1"
                      >
                        View
                      </Link>
                      <Link
                        href={`/dashboard/users/${u.id}`}
                        className="text-[#4059ad] hover:text-[#344a8a] text-sm font-medium py-1"
                      >
                        Edit
                      </Link>
                      {canDelete && (
                        <>
                          <span className="text-[#e2e8f0]">|</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(u.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium py-1"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block min-w-0 overflow-x-auto dashboard-table-scroll">
          <table className="w-full text-left table-fixed">
            <colgroup>
              <col style={{ width: "3%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead className="bg-[#f8f9fa] border-b border-[#e2e8f0]">
              <tr>
                <th className="px-2 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label="Select all users on this page"
                    checked={
                      displayUsers.length > 0 &&
                      displayUsers.every((u) => selectedIds.has(u.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(displayUsers.map((u) => u.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Status</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Name</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Phone</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Email</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Elite</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Refs</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Franchise / Referral</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Logins</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Date</th>
                <th className="px-3 py-2.5 font-semibold text-[#2d3748] text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {displayUsers.map((u) => {
                const status = u.imageStatus || "none";
                const borderColor =
                  status === "all" ? "border-l-[#10b981]" : status === "partial" ? "border-l-[#4059ad]" : "border-l-[#ef4444]";
                const franchiseRef = franchiseReferralDisplay(u, franchiseNameByNumber);
                return (
                  <tr key={u.id} className={`bg-white hover:bg-[#f8f9fa] border-l-4 ${borderColor} transition`}>
                    <td className="px-2 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`Select ${String(u["Full Name"] ?? "user")}`}
                        checked={selectedIds.has(u.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(u.id);
                            else next.delete(u.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <UserStatusBadge status={status} />
                    </td>
                    <td className="px-3 py-2.5 text-[#2d3748] font-medium text-sm truncate" title={String(u["Full Name"] ?? "")}>{u["Full Name"] ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[#718096] text-sm truncate" title={String(u["Phone Number"] ?? "")}>{u["Phone Number"] ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[#718096] text-sm truncate" title={String(u.Email ?? "")}>{u.Email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-sm">
                      {u.isEliteMember ? (
                        <span className="text-[#10b981] font-medium">Y</span>
                      ) : (
                        <span className="text-[#a0aec0]">N</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[#718096] text-sm">{u.ReferralCount ?? 0}</td>
                    <td
                      className="px-3 py-2.5 text-[#718096] text-xs truncate"
                      title={franchiseRef.title || franchiseRef.text}
                    >
                      {franchiseRef.text}
                    </td>
                    <td className="px-3 py-2.5 text-[#718096] text-sm tabular-nums">{u.LoginCount ?? 0}</td>
                    <td className="px-3 py-2.5 text-[#718096] text-xs">
                      {u["Registered On"] ? new Date(u["Registered On"]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/users/${u.id}/fingerprints`}
                          className="text-[#4059ad] hover:text-[#344a8a] text-xs font-medium"
                        >
                          View
                        </Link>
                        <span className="text-[#e2e8f0]">|</span>
                        <Link
                          href={`/dashboard/users/${u.id}`}
                          className="text-[#4059ad] hover:text-[#344a8a] text-xs font-medium"
                        >
                          Edit
                        </Link>
                        {canDelete && (
                          <>
                            <span className="text-[#e2e8f0]">|</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(u.id)}
                              className="text-red-600 hover:text-red-700 text-xs font-medium"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {displayUsers.length === 0 && !loading && !searchLoading && (
          <div className="p-12 text-center">
            <p className="text-[#718096]">
              {searchQuery.trim() ? "No users match your search." : "No users yet."}
            </p>
          </div>
        )}
        {!searchQuery.trim() && pageSize !== "all" && totalPages > 1 && (
          <div className="p-4 bg-[#f8f9fa] border-t border-[#e2e8f0]">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const prevPage = Math.max(1, currentPage - 1);
                  setCurrentPage(prevPage);
                }}
                disabled={loading || currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#2d3748] text-sm hover:bg-[#f8f9fa] hover:border-[#4059ad] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={loading || currentPage === pageNum}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      currentPage === pageNum
                        ? "bg-[#4059ad] text-white shadow-sm"
                        : "bg-white border border-[#e2e8f0] text-[#2d3748] hover:bg-[#f8f9fa] hover:border-[#4059ad] disabled:opacity-50"
                    } disabled:cursor-not-allowed`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 7 && currentPage < totalPages - 3 && (
                <>
                  <span className="text-[#a0aec0] px-2">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#2d3748] text-sm hover:bg-[#f8f9fa] hover:border-[#4059ad] disabled:opacity-50 transition"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const nextPage = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(nextPage);
                }}
                disabled={loading || currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#2d3748] text-sm hover:bg-[#f8f9fa] hover:border-[#4059ad] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
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
            <h3 className="text-lg font-semibold text-[#2d3748] mb-4">Add new user</h3>
            {addError && (
              <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{addError}</p>
            )}
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Phone Number (E.164 format)</label>
                <input
                  type="tel"
                  placeholder="e.g. +923001234567"
                  className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none font-mono"
                  value={addForm.phoneNumber}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                />
                <p className="text-[10px] text-[#a0aec0] mt-0.5">Required if email is empty. Must include country code prefix (+).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#718096] mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <p className="text-[10px] text-[#a0aec0] mt-0.5">Required if phone number is empty.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#718096] mb-1">Referral Code (optional)</label>
                  <input
                    type="text"
                    placeholder="Referral Code"
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                    value={addForm.referralCode}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, referralCode: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#718096] mb-1">Franchise (optional)</label>
                  <input
                    type="text"
                    placeholder="Franchise Number"
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                    value={addForm.franchise}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, franchise: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="add-elite"
                  className="rounded border-[#e2e8f0] text-[#4059ad] focus:ring-[#4059ad]"
                  checked={addForm.isEliteMember}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, isEliteMember: e.target.checked }))}
                />
                <label htmlFor="add-elite" className="text-sm font-medium text-[#2d3748] cursor-pointer">Elite member</label>
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
                  {addSaving ? "Creating…" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

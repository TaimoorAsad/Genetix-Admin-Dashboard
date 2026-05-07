"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";


type Stats = {
  totalUsers?: number;
  totalFranchises?: number;
  totalRequests?: number;
  topFranchises?: { id: string; name: string; number: string }[];
  topReferralUsers?: { id: string; "Full Name": string; ReferralCount: number }[];
};

type Period = "day" | "week" | "month" | "year";

type RevenueData = {
  period: Period;
  labels: string[];
  values: number[];
  totalRevenue: number;
};

type PicturesCompletedData = {
  period: Period;
  labels: string[];
  values: number[];
  totalCompleted: number;
};

type ClientOnboardingData = {
  period: Period;
  labels: string[];
  values: number[];
  totalCount: number;
};

function SimpleLineChart({ labels, values, height = 200, color = "#4059ad" }: { labels: string[]; values: number[]; height?: number; color?: string }) {
  if (!labels.length || !values.length || values.every(v => v === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-[#a0aec0] text-sm">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...values, 1);
  const padding = 40;
  const chartWidth = 600;
  const chartHeight = height - padding * 2;
  const stepX = labels.length > 1 ? (chartWidth - padding * 2) / (labels.length - 1) : 0;

  const points = values.map((val, i) => {
    const x = padding + i * stepX;
    const y = chartHeight - (val / maxValue) * chartHeight + padding;
    return { x, y };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const areaPathD = `${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={chartWidth} height={height} className="w-full" viewBox={`0 0 ${chartWidth} ${height}`}>
        <defs>
          <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPathD} fill={`url(#gradient-${color.replace("#", "")})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
        ))}
        {labels.map((label, i) => {
          const x = padding + i * stepX;
          const displayLabel = label.length > 10 ? label.substring(0, 7) + "..." : label;
          return (
            <text key={i} x={x} y={height - 10} textAnchor="middle" className="text-xs fill-[#a0aec0]">
              {displayLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { idToken, user, signOut, roleInfo } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("month");
  const [picturesPeriod, setPicturesPeriod] = useState<Period>("month");
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [picturesData, setPicturesData] = useState<PicturesCompletedData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [picturesLoading, setPicturesLoading] = useState(false);
  const [onboardingPeriod, setOnboardingPeriod] = useState<Period>("month");
  const [onboardingData, setOnboardingData] = useState<ClientOnboardingData | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!idToken) return;
    setError(null);
    fetch("/api/stats", {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body.error as string) || `Stats failed (${r.status})`);
        }
        return r.json();
      })
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, [idToken]);

  useEffect(() => {
    if (!idToken) return;
    setRevenueLoading(true);
    fetch(`/api/revenue?period=${revenuePeriod}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body.error as string) || `Revenue failed (${r.status})`);
        }
        return r.json();
      })
      .then(setRevenueData)
      .catch((err: Error) => {
        console.error("Revenue error:", err);
        setRevenueData({ period: revenuePeriod, labels: [], values: [], totalRevenue: 0 });
      })
      .finally(() => setRevenueLoading(false));
  }, [idToken, revenuePeriod]);

  useEffect(() => {
    if (!idToken) return;
    setPicturesLoading(true);
    fetch(`/api/pictures-completed?period=${picturesPeriod}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body.error as string) || `Pictures failed (${r.status})`);
        }
        return r.json();
      })
      .then(setPicturesData)
      .catch((err: Error) => {
        console.error("Pictures error:", err);
        setPicturesData({ period: picturesPeriod, labels: [], values: [], totalCompleted: 0 });
      })
      .finally(() => setPicturesLoading(false));
  }, [idToken, picturesPeriod]);

  useEffect(() => {
    if (!idToken) return;
    setOnboardingLoading(true);
    fetch(`/api/client-onboarding?period=${onboardingPeriod}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body.error as string) || `Client onboarding failed (${r.status})`);
        }
        return r.json();
      })
      .then(setOnboardingData)
      .catch((err: Error) => {
        console.error("Client onboarding error:", err);
        setOnboardingData({
          period: onboardingPeriod,
          labels: [],
          values: [],
          totalCount: 0,
        });
      })
      .finally(() => setOnboardingLoading(false));
  }, [idToken, onboardingPeriod]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const getProfileLink = () => {
    if (roleInfo?.role === "user") return "/dashboard/me";
    if (roleInfo?.role === "franchise") return "/dashboard/my-franchise";
    return "/dashboard";
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#2d3748]">Dashboard</h1>
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="w-10 h-10 rounded-full bg-[#4059ad] flex items-center justify-center text-white text-sm font-medium hover:bg-[#344a8a] transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4059ad]/20"
          >
            {user?.email?.[0]?.toUpperCase() ?? "A"}
          </button>
          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-1 z-50">
              <Link
                href={getProfileLink()}
                onClick={() => setProfileMenuOpen(false)}
                className="block px-4 py-2 text-sm text-[#2d3748] hover:bg-[#f8f9fa] transition"
              >
                View Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-[#2d3748] hover:bg-[#f8f9fa] transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {error}
          {error.includes("Unauthorized") && (
            <p className="mt-2 text-amber-700">Add your sign-in email to ADMIN_EMAILS in .env.local and restart the dev server.</p>
          )}
        </div>
      )}

      {/* Stat cards + App Installing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Link href="/dashboard/users" className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6 hover:shadow-md transition">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#97d8c4] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-[#2d3748]">
                {stats?.totalUsers != null ? stats.totalUsers : error ? "—" : "…"}
              </p>
              <p className="text-sm text-[#718096] mt-0.5">Total Users</p>
              <div className="mt-4 flex items-center gap-1 text-[#718096] text-sm">
                <span>Total Users</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/franchises" className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6 hover:shadow-md transition">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#97d8c4] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-[#2d3748]">
                {stats?.totalFranchises != null ? stats.totalFranchises : error ? "—" : "…"}
              </p>
              <p className="text-sm text-[#718096] mt-0.5">Total Franchises</p>
              <div className="mt-4 flex items-center gap-1 text-[#718096] text-sm">
                <span>Total Franchises</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#e8b86d] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-[#2d3748]">
                {stats?.totalRequests != null ? stats.totalRequests : "0"}
              </p>
              <p className="text-sm text-[#718096] mt-0.5">Total Requests</p>
              <div className="mt-4 flex items-center gap-1 text-[#718096] text-sm">
                <span>Total Requests</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <h3 className="text-[#2d3748] font-semibold mb-4">App Installing</h3>
          <div className="flex gap-2 mb-4">
            <button type="button" className="px-3 py-1.5 rounded border border-[#4059ad] text-[#4059ad] text-sm font-medium bg-[#4059ad]/5">
              Total
            </button>
            <button type="button" className="px-3 py-1.5 rounded border border-[#e2e8f0] text-[#718096] text-sm hover:bg-[#f8f9fa]">
              Android
            </button>
            <button type="button" className="px-3 py-1.5 rounded border border-[#e2e8f0] text-[#718096] text-sm hover:bg-[#f8f9fa]">
              IOS
            </button>
          </div>
          <div className="h-32 flex items-end gap-1 pb-4 border-b border-[#e2e8f0]">
            <span className="text-xs text-[#a0aec0] self-start">Feb 2026</span>
            <div className="flex-1 flex items-end justify-center gap-2">
              <div className="w-8 h-6 rounded-t bg-[#4059ad]/20" title="Installations" />
            </div>
          </div>
          <p className="text-xs text-[#a0aec0] mt-2">No installation data for this period yet.</p>
        </div>
      </div>

      {/* Top Franchises + Top Referral Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#2d3748] font-semibold">Top Franchises</h3>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#e2e8f0] text-[#718096] text-sm">
              <span>Orders</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <ul className="space-y-3">
            {stats?.topFranchises?.length ? (
              stats.topFranchises.map((f) => (
                <li key={f.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#e2e8f0] flex items-center justify-center text-[#718096] text-sm font-medium flex-shrink-0">
                    {(f.name || f.number || "F")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#2d3748] font-medium truncate">{f.name || f.number || "—"}</p>
                    <p className="text-xs text-[#718096]">{f.number || f.id}</p>
                  </div>
                  <Link href={`/dashboard/franchises`} className="text-[#4059ad] text-sm font-medium hover:underline flex-shrink-0">
                    View
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-[#718096] text-sm py-4">No franchises yet.</li>
            )}
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#2d3748] font-semibold">Top Referral Users</h3>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#e2e8f0] text-[#718096] text-sm">
              <span>All</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <ul className="space-y-3">
            {stats?.topReferralUsers?.length ? (
              stats.topReferralUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#e2e8f0] flex items-center justify-center text-[#718096] text-sm font-medium flex-shrink-0">
                    {(u["Full Name"] || "U")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#2d3748] font-medium truncate">{u["Full Name"] || "—"}</p>
                    <p className="text-xs text-[#718096]">{u.ReferralCount} referrals</p>
                  </div>
                  <Link href={`/dashboard/users/${u.id}`} className="text-[#4059ad] text-sm font-medium hover:underline flex-shrink-0">
                    View
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-[#718096] text-sm py-4">No referral users yet.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Total Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#2d3748] font-semibold">Total Revenue</h3>
            <div className="flex gap-2">
              {(["day", "week", "month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRevenuePeriod(p)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    revenuePeriod === p
                      ? "bg-[#4059ad] text-white"
                      : "bg-white border border-[#e2e8f0] text-[#718096] hover:bg-[#f8f9fa]"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {revenueLoading ? (
            <div className="h-48 flex items-center justify-center text-[#a0aec0]">Loading...</div>
          ) : revenueData ? (
            <>
              <div className="mb-4">
                <p className="text-3xl font-bold text-[#2d3748]">
                  ₹{revenueData.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-[#718096] mt-1">Total revenue ({revenuePeriod})</p>
              </div>
              <SimpleLineChart labels={revenueData.labels} values={revenueData.values} color="#4059ad" />
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-[#a0aec0] text-sm">No revenue data</div>
          )}
        </div>

        {/* Pictures Completed Users Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#2d3748] font-semibold">Pictures Completed Users</h3>
            <div className="flex gap-2">
              {(["day", "week", "month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPicturesPeriod(p)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    picturesPeriod === p
                      ? "bg-[#4059ad] text-white"
                      : "bg-white border border-[#e2e8f0] text-[#718096] hover:bg-[#f8f9fa]"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {picturesLoading ? (
            <div className="h-48 flex items-center justify-center text-[#a0aec0]">Loading...</div>
          ) : picturesData ? (
            <>
              <div className="mb-4">
                <p className="text-3xl font-bold text-[#2d3748]">{picturesData.totalCompleted}</p>
                <p className="text-sm text-[#718096] mt-1">Users with all images ({picturesPeriod})</p>
              </div>
              <SimpleLineChart labels={picturesData.labels} values={picturesData.values} color="#97d8c4" />
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-[#a0aec0] text-sm">No data available</div>
          )}
        </div>
      </div>

      {/* Client Onboarding Chart */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#2d3748] font-semibold">Client onboarding</h3>
            <div className="flex gap-2">
              {(["day", "week", "month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOnboardingPeriod(p)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    onboardingPeriod === p
                      ? "bg-[#4059ad] text-white"
                      : "bg-white border border-[#e2e8f0] text-[#718096] hover:bg-[#f8f9fa]"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {onboardingLoading ? (
            <div className="h-48 flex items-center justify-center text-[#a0aec0]">Loading…</div>
          ) : onboardingData ? (
            <>
              <div className="mb-4">
                <p className="text-3xl font-bold text-[#2d3748]">
                  {onboardingData.totalCount}
                </p>
                <p className="text-sm text-[#718096] mt-1">
                  New clients onboarded ({onboardingPeriod})
                </p>
              </div>
              <SimpleLineChart
                labels={onboardingData.labels}
                values={onboardingData.values}
                color="#ed8936"
              />
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-[#a0aec0] text-sm">
              No onboarding data
            </div>
          )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow-sm p-6 border border-[#e2e8f0]">
        <h2 className="text-lg font-semibold text-[#2d3748] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/users" className="p-4 rounded-lg border border-[#e2e8f0] hover:border-[#4059ad] hover:bg-[#f8f9fa] transition">
            <p className="font-medium text-[#2d3748]">Manage Users</p>
            <p className="text-sm text-[#718096] mt-1">View and edit user accounts</p>
          </Link>
          <Link href="/dashboard/franchises" className="p-4 rounded-lg border border-[#e2e8f0] hover:border-[#4059ad] hover:bg-[#f8f9fa] transition">
            <p className="font-medium text-[#2d3748]">Manage Franchises</p>
            <p className="text-sm text-[#718096] mt-1">View and manage franchises</p>
          </Link>
          <Link href="/dashboard/app-data" className="p-4 rounded-lg border border-[#e2e8f0] hover:border-[#4059ad] hover:bg-[#f8f9fa] transition">
            <p className="font-medium text-[#2d3748]">App Configuration</p>
            <p className="text-sm text-[#718096] mt-1">Edit app data and settings</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

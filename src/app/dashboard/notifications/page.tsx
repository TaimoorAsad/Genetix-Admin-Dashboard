"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardNotification, NotificationType, NotificationAudience } from "@/lib/notifications";

const typeLabels: Record<NotificationType | "all", string> = {
  all: "All",
  sign_in: "Sign-ins",
  image_upload: "Image uploads",
  elite_purchase: "Elite memberships",
  other: "Other",
};

const typeColors: Record<NotificationType, string> = {
  sign_in: "#3182ce",
  image_upload: "#805ad5",
  elite_purchase: "#38a169",
  other: "#a0aec0",
};

const audienceLabels: Record<NotificationAudience, string> = {
  all: "All users",
  no_images: "No images (red)",
  partial_images: "Partial images (blue)",
  all_images: "All images (green)",
  elite: "Elite membership",
};

export default function NotificationsPage() {
  const { idToken, roleInfo } = useAuth();
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<NotificationType | "all">("all");
  const [sendMessage, setSendMessage] = useState("");
  const [sendAudience, setSendAudience] = useState<NotificationAudience>("all");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<number | null>(null);
  const [sendDetail, setSendDetail] = useState<string | null>(null);

  const isAdmin = roleInfo?.role === "admin";
  const loadNotifications = useCallback(() => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (activeType !== "all") params.set("type", activeType);
    params.set("limit", "100");
    fetch(`/api/notifications?${params.toString()}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body.error as string) || `Failed to load notifications (${r.status})`);
        }
        return r.json();
      })
      .then((data) => {
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      })
      .catch((err: Error) => {
        console.error("Notifications error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [idToken, activeType]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleSendToApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !sendMessage.trim() || sending) return;
    setSending(true);
    setError(null);
      setSendSuccess(null);
      setSendDetail(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ message: sendMessage.trim(), audience: sendAudience }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error as string) || `Send failed (${res.status})`);
      setSendSuccess(data.sent ?? 0);
      setSendDetail(data.message ?? null);
      setSendMessage("");
      loadNotifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const chipForType = (type: NotificationType) => {
    const color = typeColors[type];
    const label = typeLabels[type];
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        {label}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#2d3748]">Notifications</h1>
          <p className="text-sm text-[#718096] mt-1">
            Recent activity from the Genetix app: sign-ins, image uploads, and elite purchases.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="mb-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Send notification to app users</h2>
          <p className="text-sm text-[#718096] mb-4">
            Message will appear in the app for the selected audience. Pre-built segments: all users, by image status, or Elite members only.
          </p>
          <form onSubmit={handleSendToApp} className="space-y-4">
            <div>
              <label htmlFor="send-message" className="block text-sm font-medium text-[#2d3748] mb-1">Message</label>
              <textarea
                id="send-message"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="e.g. New feature available! Update your profile images to get the full report."
                rows={3}
                required
                className="w-full rounded-lg border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none resize-y min-h-[80px]"
              />
            </div>
            <div>
              <label htmlFor="send-audience" className="block text-sm font-medium text-[#2d3748] mb-1">Audience</label>
              <select
                id="send-audience"
                value={sendAudience}
                onChange={(e) => setSendAudience(e.target.value as NotificationAudience)}
                className="w-full max-w-xs rounded-lg border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
              >
                {(Object.keys(audienceLabels) as NotificationAudience[]).map((a) => (
                  <option key={a} value={a}>{audienceLabels[a]}</option>
                ))}
              </select>
            </div>
            {sendSuccess !== null && (
              <div className="space-y-1">
                <p className="text-sm text-green-600 font-medium">Sent to {sendSuccess} user(s).</p>
                {sendDetail && <p className="text-xs text-[#718096]">{sendDetail}</p>}
              </div>
            )}
            <button
              type="submit"
              disabled={sending || !sendMessage.trim()}
              className="px-4 py-2.5 rounded-lg bg-[#4059ad] text-white font-medium text-sm hover:bg-[#344a8a] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {sending ? "Sending…" : "Send to app users"}
            </button>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(typeLabels) as (NotificationType | "all")[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveType(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
              activeType === t
                ? "bg-[#4059ad] border-[#4059ad] text-white"
                : "bg-white border-[#e2e8f0] text-[#718096] hover:bg-[#f8f9fa]"
            }`}
          >
            {typeLabels[t]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-[#a0aec0] text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-[#a0aec0] text-sm">
            No notifications found for this filter.
          </div>
        ) : (
          <ul className="divide-y divide-[#e2e8f0]">
            {notifications.map((n) => {
              const color = typeColors[n.type] || typeColors.other;
              return (
                <li key={n.id} className="flex gap-4 px-6 py-4 hover:bg-[#f8f9fa]/50">
                  <div
                    className="w-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[#2d3748]">{n.message}</p>
                        {chipForType(n.type)}
                      </div>
                      <p className="text-xs text-[#a0aec0]">{formatDateTime(n.createdAt)}</p>
                    </div>
                    {(n.userName || n.userEmail) && (
                      <p className="text-xs text-[#718096]">
                        {n.userName && <span className="font-medium">{n.userName}</span>}
                        {n.userName && n.userEmail && <span className="mx-1">•</span>}
                        {n.userEmail && <span>{n.userEmail}</span>}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-[#a0aec0]">
        To populate this feed, write activity documents into the{" "}
        <code className="px-1 py-0.5 rounded bg-[#edf2f7] text-[0.7rem]">dashboardNotifications</code> Firestore
        collection from your mobile app or backend.
      </p>
    </div>
  );
}


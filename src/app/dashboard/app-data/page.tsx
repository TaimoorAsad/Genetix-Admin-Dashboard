"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const NOTIFICATION_EMAIL_DOC_ID = "Settings";
const NOTIFICATION_EMAIL_FALLBACK = "dmitbrainvita@gmail.com";
const CHATBOT_SECRETS_DOC_ID = "Secrets";

type AppDataDoc = {
  id: string;
  link?: string;
  "Client Playlist"?: string[];
  notificationEmail?: string;
  /** Home → "Share review on Google" link (appData/Settings.googleReviewUrl) */
  googleReviewUrl?: string;
  chatbotApiUrl?: string;
  chatbotSystemPrompt?: string;
  chatbotMemoryMessages?: number | string;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiApiBase?: string;
  razorpayKey?: string;
  razorpaySecret?: string;
  fingerprintQualityTitle?: string;
  fingerprintQualityBody?: string;
  fingerprintQualityImageUrls?: string[];
  supportHelpVideos?: { title?: string; videoId?: string; videoUrl?: string }[];
  fingerprintHelpVideos?: { title?: string; videoId?: string; videoUrl?: string }[];
  /** Buy Elite screen — "Use Code" banner (appData/Settings.elitePromoCode) */
  elitePromoCode?: string;
  [key: string]: unknown;
};

type HelpVideoRow = { title: string; videoIdOrUrl: string };

const DEFAULT_HELP_VIDEO_ROWS: HelpVideoRow[] = [
  { title: "How it works", videoIdOrUrl: "EeGH6VtXxPA" },
  { title: "Getting started", videoIdOrUrl: "9vk7Nuuttdw" },
  { title: "Support walkthrough", videoIdOrUrl: "WAZTO-FprQY" },
];

function parseHelpVideoRows(raw: unknown): HelpVideoRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_HELP_VIDEO_ROWS.map((r) => ({ ...r }));
  }
  const rows: HelpVideoRow[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const o = item as { title?: string; videoId?: string; videoUrl?: string };
      rows.push({
        title: String(o.title ?? "").trim(),
        videoIdOrUrl: String(o.videoId ?? o.videoUrl ?? "").trim(),
      });
    }
  }
  return rows.length > 0 ? rows.slice(0, 5) : DEFAULT_HELP_VIDEO_ROWS.map((r) => ({ ...r }));
}

function rowsToFirestoreVideos(rows: HelpVideoRow[], extractYouTubeId: (s: string) => string | null): { title: string; videoId: string }[] {
  const out: { title: string; videoId: string }[] = [];
  for (const r of rows) {
    const id = extractYouTubeId(r.videoIdOrUrl);
    if (!id) continue;
    out.push({ title: (r.title || "Video").trim() || "Video", videoId: id });
  }
  return out;
}

export default function AppDataPage() {
  const { idToken, roleInfo } = useAuth();
  const canEdit = roleInfo?.role === "admin" || Boolean(roleInfo?.permissions?.canEditAppData);
  const [appLink, setAppLink] = useState<AppDataDoc | null>(null);
  const [, setYoutube] = useState<AppDataDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState("");
  const [notificationEmailDoc, setNotificationEmailDoc] = useState<AppDataDoc | null>(null);
  const [savingNotificationEmail, setSavingNotificationEmail] = useState(false);
  const [secretsDoc, setSecretsDoc] = useState<AppDataDoc | null>(null);
  const [savingChatbot, setSavingChatbot] = useState(false);
  const [savingSecrets, setSavingSecrets] = useState(false);
  const [qualityImageUrls, setQualityImageUrls] = useState<string[]>([]);
  const [savingFingerprintQuality, setSavingFingerprintQuality] = useState(false);
  const [supportHelpVideoRows, setSupportHelpVideoRows] = useState<HelpVideoRow[]>(() => [...DEFAULT_HELP_VIDEO_ROWS]);
  const [fingerprintHelpVideoRows, setFingerprintHelpVideoRows] = useState<HelpVideoRow[]>(() => [...DEFAULT_HELP_VIDEO_ROWS]);
  const [savingHelpVideos, setSavingHelpVideos] = useState(false);

  const load = useCallback(() => {
    if (!idToken) return;
    const getDoc = (doc: string) =>
      fetch(`/api/app-data?doc=${doc}`, { headers: { Authorization: `Bearer ${idToken}` } })
        .then((r) => (r.ok ? r.json() : { id: doc }))
        .catch(() => ({ id: doc }));
    Promise.all([getDoc("AppLink"), getDoc("Youtube"), getDoc(NOTIFICATION_EMAIL_DOC_ID), getDoc(CHATBOT_SECRETS_DOC_ID)])
      .then(([linkData, ytData, settingsData, secretsData]) => {
        setAppLink(linkData);
        setYoutube(ytData);
        setNotificationEmailDoc(settingsData);
        setSecretsDoc(secretsData);
        const arr = (ytData["Client Playlist"] as string[] | undefined) || [];
        setPlaylistItems(arr);
        const imgs = (settingsData.fingerprintQualityImageUrls as string[] | undefined) || [];
        setQualityImageUrls(imgs);
        setSupportHelpVideoRows(parseHelpVideoRows(settingsData.supportHelpVideos));
        setFingerprintHelpVideoRows(parseHelpVideoRows(settingsData.fingerprintHelpVideos));
      })
      .catch(() => setError("Failed to load app data"))
      .finally(() => setLoading(false));
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAppLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSaving("AppLink");
    setError(null);
    try {
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ docId: "AppLink", link: (appLink as { link?: string })?.link }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setAppLink(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const extractYouTubeId = (urlOrId: string): string | null => {
    const trimmed = urlOrId.trim();
    if (!trimmed) return null;

    // If it's already just an ID (alphanumeric, dashes, underscores)
    if (/^[a-zA-Z0-9_-]{11,}$/.test(trimmed)) {
      return trimmed;
    }

    // Try to extract from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11,})/,
      /(?:youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]+)/,
      /(?:youtube\.com\/watch\?.*&list=)([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrlInput.trim() || !canEdit) return;

    const id = extractYouTubeId(newUrlInput);
    if (!id) {
      setError("Invalid YouTube URL or ID. Please enter a valid YouTube URL or video/playlist ID.");
      return;
    }

    if (playlistItems.includes(id)) {
      setError("This video/playlist ID is already in the list.");
      return;
    }

    setPlaylistItems([...playlistItems, id]);
    setNewUrlInput("");
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    if (!canEdit) return;
    setPlaylistItems(playlistItems.filter((_, i) => i !== index));
  };

  const saveNotificationEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSavingNotificationEmail(true);
    setError(null);
    try {
      const email = (notificationEmailDoc?.notificationEmail ?? "").trim();
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ docId: NOTIFICATION_EMAIL_DOC_ID, notificationEmail: email || null }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setNotificationEmailDoc(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingNotificationEmail(false);
    }
  };

  const saveChatbotSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSavingChatbot(true);
    setError(null);
    try {
      const url = (notificationEmailDoc?.chatbotApiUrl ?? "").trim();
      const prompt = (notificationEmailDoc?.chatbotSystemPrompt as string | undefined)?.trim() ?? "";
      const rawMemory = notificationEmailDoc?.chatbotMemoryMessages;
      let memory: number | null = null;
      if (typeof rawMemory === "number" && Number.isFinite(rawMemory)) {
        memory = Math.max(1, Math.min(20, Math.round(rawMemory)));
      } else if (typeof rawMemory === "string" && rawMemory.trim()) {
        const parsed = Number(rawMemory.trim());
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          memory = Math.max(1, Math.min(20, Math.round(parsed)));
        }
      }
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          docId: NOTIFICATION_EMAIL_DOC_ID,
          chatbotApiUrl: url || null,
          chatbotSystemPrompt: prompt || null,
          chatbotMemoryMessages: memory,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setNotificationEmailDoc(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingChatbot(false);
    }
  };

  const saveGoogleReviewUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSaving("GoogleReviewUrl");
    setError(null);
    try {
      const url = (notificationEmailDoc?.googleReviewUrl ?? "").trim();
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          docId: NOTIFICATION_EMAIL_DOC_ID,
          googleReviewUrl: url || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setNotificationEmailDoc(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const saveServerSecrets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSavingSecrets(true);
    setError(null);
    try {
      const openaiApiKey = (secretsDoc?.openaiApiKey ?? "").trim();
      const openaiModel = (secretsDoc?.openaiModel ?? "").trim();
      const openaiApiBase = (secretsDoc?.openaiApiBase ?? "").trim();
      const razorpayKey = (secretsDoc?.razorpayKey ?? "").trim();
      const razorpaySecret = (secretsDoc?.razorpaySecret ?? "").trim();
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          docId: CHATBOT_SECRETS_DOC_ID,
          openaiApiKey: openaiApiKey || null,
          openaiModel: openaiModel || null,
          openaiApiBase: openaiApiBase || null,
          razorpayKey: razorpayKey || null,
          razorpaySecret: razorpaySecret || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSecretsDoc(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingSecrets(false);
    }
  };

  const saveFingerprintQuality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSavingFingerprintQuality(true);
    setError(null);
    try {
      const title = (notificationEmailDoc?.fingerprintQualityTitle as string | undefined)?.trim() ?? "";
      const body = (notificationEmailDoc?.fingerprintQualityBody as string | undefined)?.trim() ?? "";
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          docId: NOTIFICATION_EMAIL_DOC_ID,
          fingerprintQualityTitle: title || null,
          fingerprintQualityBody: body || null,
          fingerprintQualityImageUrls: qualityImageUrls,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setNotificationEmailDoc(data);
      const imgs = (data.fingerprintQualityImageUrls as string[] | undefined) || [];
      setQualityImageUrls(imgs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingFingerprintQuality(false);
    }
  };

  const saveHelpVideos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !canEdit) return;
    setSavingHelpVideos(true);
    setError(null);
    try {
      const support = rowsToFirestoreVideos(supportHelpVideoRows, extractYouTubeId);
      const fingerprint = rowsToFirestoreVideos(fingerprintHelpVideoRows, extractYouTubeId);
      if (support.length === 0 || fingerprint.length === 0) {
        setError("Each tab needs at least one valid YouTube video URL or 11-character video ID.");
        return;
      }
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          docId: NOTIFICATION_EMAIL_DOC_ID,
          supportHelpVideos: support,
          fingerprintHelpVideos: fingerprint,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setNotificationEmailDoc(data);
      setSupportHelpVideoRows(parseHelpVideoRows(data.supportHelpVideos));
      setFingerprintHelpVideoRows(parseHelpVideoRows(data.fingerprintHelpVideos));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingHelpVideos(false);
    }
  };

  const saveYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSaving("Youtube");
    setError(null);
    try {
      const res = await fetch("/api/app-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ docId: "Youtube", "Client Playlist": playlistItems }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setYoutube(data);
      setPlaylistItems((data["Client Playlist"] as string[] || []));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">App Data</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-6">App Data</h1>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-4">App Link (appData/AppLink)</h2>
          <form onSubmit={saveAppLink} className="space-y-4">
            <input
              type="text"
              value={(appLink as { link?: string })?.link ?? ""}
              onChange={(e) => setAppLink((prev) => (prev ? { ...prev, link: e.target.value } : { id: "AppLink", link: e.target.value }))}
              placeholder="App deep link or URL"
              readOnly={!canEdit}
              className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
            />
            {canEdit && (
              <button
                type="submit"
                disabled={saving === "AppLink"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving === "AppLink" ? "Saving..." : "Save"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-4">Notification email (signups & purchases)</h2>
          <p className="text-[#718096] text-sm mb-2">
            All user signup notifications, fingerprint submissions, and subscription purchase emails from the app are sent to this address.
          </p>
          <p className="text-[#718096] text-sm mb-4">
            <strong>Currently used:</strong>{" "}
            <span className="text-[#2d3748] font-medium">
              {(notificationEmailDoc?.notificationEmail as string)?.trim() || NOTIFICATION_EMAIL_FALLBACK}
            </span>
            {!(notificationEmailDoc?.notificationEmail as string)?.trim() && (
              <span className="text-amber-600 ml-1">(app default; set below to change)</span>
            )}
          </p>
          <form onSubmit={saveNotificationEmail} className="space-y-4">
            <input
              type="email"
              value={(notificationEmailDoc?.notificationEmail as string) ?? ""}
              onChange={(e) =>
                setNotificationEmailDoc((prev) =>
                  prev ? { ...prev, notificationEmail: e.target.value } : { id: NOTIFICATION_EMAIL_DOC_ID, notificationEmail: e.target.value }
                )
              }
              placeholder={NOTIFICATION_EMAIL_FALLBACK}
              readOnly={!canEdit}
              className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
            />
            {canEdit && (
              <button
                type="submit"
                disabled={savingNotificationEmail}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {savingNotificationEmail ? "Saving..." : "Save"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Home — Google review link</h2>
          <p className="text-[#718096] text-sm mb-4">
            This controls the mobile app button <strong>Home → Share review on Google</strong> (
            <code className="text-xs bg-[#f7fafc] px-1 rounded">appData/Settings.googleReviewUrl</code>).
          </p>
          <form onSubmit={saveGoogleReviewUrl} className="space-y-4">
            <input
              type="url"
              value={(notificationEmailDoc?.googleReviewUrl as string) ?? ""}
              onChange={(e) =>
                setNotificationEmailDoc((prev) =>
                  prev ? { ...prev, googleReviewUrl: e.target.value } : { id: NOTIFICATION_EMAIL_DOC_ID, googleReviewUrl: e.target.value }
                )
              }
              placeholder="https://g.page/.../review or https://search.google.com/local/writereview?placeid=..."
              readOnly={!canEdit}
              className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
            />
            {canEdit && (
              <button
                type="submit"
                disabled={saving === "GoogleReviewUrl"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving === "GoogleReviewUrl" ? "Saving..." : "Save"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Chatbot (OpenAI)</h2>
          <p className="text-[#718096] text-sm mb-4">
            Configure the mobile app chatbot endpoint and the OpenAI API key used by the dashboard server (
            <code className="text-xs">/api/chat</code>). Create a key in{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#4059ad] hover:underline">
              OpenAI dashboard
            </a>
            .
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-[#2d3748] mb-2">Mobile app setting (appData/Settings)</h3>
              <form onSubmit={saveChatbotSettings} className="space-y-3">
                <input
                  type="text"
                  value={(notificationEmailDoc?.chatbotApiUrl as string) ?? ""}
                  onChange={(e) =>
                    setNotificationEmailDoc((prev) =>
                      prev ? { ...prev, chatbotApiUrl: e.target.value } : { id: NOTIFICATION_EMAIL_DOC_ID, chatbotApiUrl: e.target.value }
                    )
                  }
                  placeholder="https://your-domain.vercel.app/api/chat"
                  readOnly={!canEdit}
                  className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                />
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#4a5568]">
                    System prompt (appData/Settings.chatbotSystemPrompt)
                  </label>
                  <textarea
                    value={(notificationEmailDoc?.chatbotSystemPrompt as string) ?? ""}
                    onChange={(e) =>
                      setNotificationEmailDoc((prev) =>
                        prev
                          ? { ...prev, chatbotSystemPrompt: e.target.value }
                          : { id: NOTIFICATION_EMAIL_DOC_ID, chatbotSystemPrompt: e.target.value }
                      )
                    }
                    placeholder={
                      "Answer in 50–100 words. Only answer about this app.\n\nThis is a DMIT / fingerprint analysis app. Users can sign up/login, manage profile, upload left/right-hand fingerprint images, view reports/content, buy Elite membership, use counselling services, use the referral system (U Share V Care), and use Support & help videos. If unsure, ask a clarifying question."
                    }
                    readOnly={!canEdit}
                    rows={4}
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#4a5568]">
                    Conversation memory (messages, 1–20)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={
                      notificationEmailDoc?.chatbotMemoryMessages !== undefined &&
                      notificationEmailDoc?.chatbotMemoryMessages !== null
                        ? String(notificationEmailDoc.chatbotMemoryMessages as string | number)
                        : ""
                    }
                    onChange={(e) =>
                      setNotificationEmailDoc((prev) =>
                        prev
                          ? { ...prev, chatbotMemoryMessages: e.target.value }
                          : { id: NOTIFICATION_EMAIL_DOC_ID, chatbotMemoryMessages: e.target.value }
                      )
                    }
                    placeholder="5"
                    readOnly={!canEdit}
                    className="w-24 rounded-lg bg-white border border-[#e2e8f0] px-3 py-1.5 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                  />
                  <p className="text-[11px] text-[#a0aec0]">
                    Number of recent user/assistant messages sent with each request (default 5).
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={savingChatbot}
                    className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
                  >
                    {savingChatbot ? "Saving..." : "Save chatbot settings"}
                  </button>
                )}
              </form>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#2d3748] mb-2">Server secrets (appData/Secrets)</h3>
              <form onSubmit={saveServerSecrets} className="space-y-3">
                <input
                  type="password"
                  value={(secretsDoc?.openaiApiKey as string) ?? ""}
                  onChange={(e) =>
                    setSecretsDoc((prev) =>
                      prev ? { ...prev, openaiApiKey: e.target.value } : { id: CHATBOT_SECRETS_DOC_ID, openaiApiKey: e.target.value }
                    )
                  }
                  placeholder="OpenAI API key"
                  readOnly={!canEdit}
                  className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={(secretsDoc?.openaiModel as string) ?? ""}
                    onChange={(e) =>
                      setSecretsDoc((prev) =>
                        prev ? { ...prev, openaiModel: e.target.value } : { id: CHATBOT_SECRETS_DOC_ID, openaiModel: e.target.value }
                      )
                    }
                    placeholder="Model (optional) e.g. gpt-4o-mini"
                    readOnly={!canEdit}
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                  />
                  <input
                    type="text"
                    value={(secretsDoc?.openaiApiBase as string) ?? ""}
                    onChange={(e) =>
                      setSecretsDoc((prev) =>
                        prev ? { ...prev, openaiApiBase: e.target.value } : { id: CHATBOT_SECRETS_DOC_ID, openaiApiBase: e.target.value }
                      )
                    }
                    placeholder="API base URL (optional) default: https://api.openai.com/v1"
                    readOnly={!canEdit}
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={(secretsDoc?.razorpayKey as string) ?? ""}
                    onChange={(e) =>
                      setSecretsDoc((prev) =>
                        prev ? { ...prev, razorpayKey: e.target.value } : { id: CHATBOT_SECRETS_DOC_ID, razorpayKey: e.target.value }
                      )
                    }
                    placeholder="Razorpay key (optional)"
                    readOnly={!canEdit}
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                  />
                  <input
                    type="password"
                    value={(secretsDoc?.razorpaySecret as string) ?? ""}
                    onChange={(e) =>
                      setSecretsDoc((prev) =>
                        prev ? { ...prev, razorpaySecret: e.target.value } : { id: CHATBOT_SECRETS_DOC_ID, razorpaySecret: e.target.value }
                      )
                    }
                    placeholder="Razorpay secret (optional)"
                    readOnly={!canEdit}
                    className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                  />
                </div>
                <p className="text-xs text-[#718096] mb-2">
                  <strong className="text-[#4a5568]">Recommended lightweight model:</strong>{" "}
                  <code className="text-[11px]">gpt-4o-mini</code> (fast + low cost).
                </p>
                <p className="text-xs text-[#718096]">
                  Note: This key is stored in Firestore. Make sure your Firestore security rules prevent app users from reading <code>appData/Secrets</code>.
                  (The mobile app only needs <code>appData/Settings.chatbotApiUrl</code>.) You can also set <code>OPENAI_API_KEY</code>,{" "}
                  <code>OPENAI_MODEL</code>, and <code>OPENAI_API_BASE</code> on the server instead of Firestore.
                </p>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={savingSecrets}
                    className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
                  >
                    {savingSecrets ? "Saving..." : "Save server secrets"}
                  </button>
                )}
              </form>
            </div>
          </div>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Fingerprint poor-quality message</h2>
          <p className="text-[#718096] text-sm mb-4">
            This message is shown in the mobile app when a fingerprint image is rejected for poor quality. You can customize the text and attach
            reference images to help users capture better fingerprints.
          </p>
          <form onSubmit={saveFingerprintQuality} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#4a5568]">
                Dialog title (appData/Settings.fingerprintQualityTitle)
              </label>
              <input
                type="text"
                value={(notificationEmailDoc?.fingerprintQualityTitle as string) ?? ""}
                onChange={(e) =>
                  setNotificationEmailDoc((prev) =>
                    prev
                      ? { ...prev, fingerprintQualityTitle: e.target.value }
                      : { id: NOTIFICATION_EMAIL_DOC_ID, fingerprintQualityTitle: e.target.value }
                  )
                }
                placeholder="Poor Image Quality"
                readOnly={!canEdit}
                className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#4a5568]">
                Message body (supports line breaks, tips, bullet points)
              </label>
              <textarea
                value={(notificationEmailDoc?.fingerprintQualityBody as string) ?? ""}
                onChange={(e) =>
                  setNotificationEmailDoc((prev) =>
                    prev
                      ? { ...prev, fingerprintQualityBody: e.target.value }
                      : { id: NOTIFICATION_EMAIL_DOC_ID, fingerprintQualityBody: e.target.value }
                  )
                }
                placeholder={
                  "Fingerprint ridges are not clearly visible in this image.\n\nTips for better results:\n• Apply a little talcum powder on the finger\n• Ensure proper lighting (not too bright/dark)\n• Use the zoom feature to get a close-up\n• Make sure the finger is clean and dry\n• Hold the camera steady and wait for focus"
                }
                readOnly={!canEdit}
                rows={5}
                className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#4a5568]">
                Reference images (URLs) shown below the message in the app
              </label>
              <div className="space-y-2">
                {qualityImageUrls.length === 0 && (
                  <p className="text-[11px] text-[#a0aec0]">No images added yet. Add one or more URLs to show example images to users.</p>
                )}
                {qualityImageUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const next = [...qualityImageUrls];
                        next[index] = e.target.value;
                        setQualityImageUrls(next);
                      }}
                      placeholder="https://..."
                      readOnly={!canEdit}
                      className="flex-1 rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setQualityImageUrls(qualityImageUrls.filter((_, i) => i !== index))}
                        className="px-2 py-1 rounded-md border border-red-200 text-[11px] text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setQualityImageUrls([...qualityImageUrls, ""])}
                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-dashed border-[#cbd5e0] text-xs text-[#4a5568] hover:bg-[#f7fafc]"
                  >
                    + Add image URL
                  </button>
                )}
              </div>
            </div>
            {canEdit && (
              <button
                type="submit"
                disabled={savingFingerprintQuality}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {savingFingerprintQuality ? "Saving..." : "Save fingerprint message"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm md:col-span-2 max-w-5xl">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Help videos — Support &amp; FingerPrint tabs</h2>
          <p className="text-[#718096] text-sm mb-4">
            Each tab in the mobile app shows a YouTube player and three buttons. Configure titles and videos separately:{" "}
            <code className="text-xs bg-[#f7fafc] px-1 rounded">appData/Settings.supportHelpVideos</code> and{" "}
            <code className="text-xs bg-[#f7fafc] px-1 rounded">appData/Settings.fingerprintHelpVideos</code> (arrays of{" "}
            <code className="text-xs">title</code> + <code className="text-xs">videoId</code>).
          </p>
          <form onSubmit={saveHelpVideos} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#4059ad]">Support tab</h3>
                {[0, 1, 2].map((i) => (
                  <div key={`s-${i}`} className="rounded-lg border border-[#e2e8f0] p-3 space-y-2 bg-[#fafbfc]">
                    <p className="text-xs font-medium text-[#718096]">Button {i + 1}</p>
                    <input
                      type="text"
                      value={supportHelpVideoRows[i]?.title ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSupportHelpVideoRows((prev) => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ title: "", videoIdOrUrl: "" });
                          next[i] = { ...next[i], title: v };
                          return next;
                        });
                      }}
                      placeholder="Button label"
                      readOnly={!canEdit}
                      className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                    />
                    <input
                      type="text"
                      value={supportHelpVideoRows[i]?.videoIdOrUrl ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSupportHelpVideoRows((prev) => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ title: "", videoIdOrUrl: "" });
                          next[i] = { ...next[i], videoIdOrUrl: v };
                          return next;
                        });
                      }}
                      placeholder="YouTube URL or 11-char video ID"
                      readOnly={!canEdit}
                      className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm font-mono text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#4059ad]">FingerPrint tab</h3>
                {[0, 1, 2].map((i) => (
                  <div key={`f-${i}`} className="rounded-lg border border-[#e2e8f0] p-3 space-y-2 bg-[#fafbfc]">
                    <p className="text-xs font-medium text-[#718096]">Button {i + 1}</p>
                    <input
                      type="text"
                      value={fingerprintHelpVideoRows[i]?.title ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFingerprintHelpVideoRows((prev) => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ title: "", videoIdOrUrl: "" });
                          next[i] = { ...next[i], title: v };
                          return next;
                        });
                      }}
                      placeholder="Button label"
                      readOnly={!canEdit}
                      className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                    />
                    <input
                      type="text"
                      value={fingerprintHelpVideoRows[i]?.videoIdOrUrl ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFingerprintHelpVideoRows((prev) => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ title: "", videoIdOrUrl: "" });
                          next[i] = { ...next[i], videoIdOrUrl: v };
                          return next;
                        });
                      }}
                      placeholder="YouTube URL or 11-char video ID"
                      readOnly={!canEdit}
                      className="w-full rounded-lg bg-white border border-[#e2e8f0] px-3 py-2 text-sm font-mono text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
                    />
                  </div>
                ))}
              </div>
            </div>
            {canEdit && (
              <button
                type="submit"
                disabled={savingHelpVideos}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {savingHelpVideos ? "Saving..." : "Save help videos"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Buy Elite — promo code</h2>
          <p className="text-[#718096] text-sm mb-4">
            Displayed on the mobile app <strong>Buy Elite</strong> screen in the &quot;Use Code&quot; banner (
            <code className="text-xs bg-[#f7fafc] px-1 rounded">appData/Settings.elitePromoCode</code>). Leave empty to use the
            default <code className="text-xs">ELITE23</code>.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!idToken) return;
              setSaving("ElitePromo");
              setError(null);
              try {
                const code = (notificationEmailDoc?.elitePromoCode as string | undefined)?.trim() ?? "";
                const res = await fetch("/api/app-data", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                  body: JSON.stringify({
                    docId: NOTIFICATION_EMAIL_DOC_ID,
                    elitePromoCode: code || null,
                  }),
                });
                if (!res.ok) throw new Error("Save failed");
                const data = await res.json();
                setNotificationEmailDoc(data);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Save failed");
              } finally {
                setSaving(null);
              }
            }}
            className="space-y-4"
          >
            <input
              type="text"
              value={(notificationEmailDoc?.elitePromoCode as string) ?? ""}
              onChange={(e) =>
                setNotificationEmailDoc((prev) =>
                  prev ? { ...prev, elitePromoCode: e.target.value } : { id: NOTIFICATION_EMAIL_DOC_ID, elitePromoCode: e.target.value },
                )
              }
              placeholder="ELITE23"
              readOnly={!canEdit}
              className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa] font-mono"
            />
            {canEdit && (
              <button
                type="submit"
                disabled={saving === "ElitePromo"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving === "ElitePromo" ? "Saving..." : "Save promo code"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">Referral share message</h2>
          <p className="text-[#718096] text-sm mb-4">
            This text is used when users share their referral link from the app. The link is automatically appended at the end.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!idToken) return;
              setSaving("ReferralShare");
              setError(null);
              try {
                const message = (notificationEmailDoc?.referralShareMessage as string | undefined)?.trim() ?? "";
                const res = await fetch("/api/app-data", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
                  body: JSON.stringify({
                    docId: NOTIFICATION_EMAIL_DOC_ID,
                    referralShareMessage: message || null,
                  }),
                });
                if (!res.ok) throw new Error("Save failed");
                const data = await res.json();
                setNotificationEmailDoc(data);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Save failed");
              } finally {
                setSaving(null);
              }
            }}
            className="space-y-4"
          >
            <textarea
              value={(notificationEmailDoc?.referralShareMessage as string) ?? ""}
              onChange={(e) =>
                setNotificationEmailDoc((prev) =>
                  prev ? { ...prev, referralShareMessage: e.target.value } : { id: NOTIFICATION_EMAIL_DOC_ID, referralShareMessage: e.target.value },
                )
              }
              placeholder={
                "Scientifically Proven method\n&\nClinically Tested Methodology\n\n👉DMIT help us to know👈\n\n🎯 Know your Inborn Talent\n🎯 Explore Inner Strength\n🎯 Hidden potential\n🎯 Powerful Personality Assessment\n🎯 Greater Professional Success\n🎯 See yourself in new Avatar\n\nDr. Bijal Dalal\n+91-9987627776\nhttps://GENetiX.in by Brain-Vita"
              }
              readOnly={!canEdit}
              rows={10}
              className="w-full rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-sm text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none disabled:opacity-70 disabled:bg-[#f8f9fa]"
            />
            {canEdit && (
              <button
                type="submit"
                disabled={saving === "ReferralShare"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving === "ReferralShare" ? "Saving..." : "Save referral message"}
              </button>
            )}
          </form>
        </section>

        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-2">YouTube Client Playlist (appData/Youtube)</h2>
          <p className="text-[#718096] text-sm mb-4">
            Used by the mobile app <strong>Client Feedback</strong> page to play a playlist of testimonial videos.
            Enter a YouTube URL or video/playlist ID and click Add to add it to the list.
          </p>
          
          {canEdit && (
            <form onSubmit={handleAddUrl} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUrlInput}
                  onChange={(e) => {
                    setNewUrlInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=... or video/playlist ID"
                  className="flex-1 rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-[#97d8c4] hover:bg-[#7fc9b3] text-white text-sm font-medium shadow-sm transition"
                >
                  Add
                </button>
              </div>
            </form>
          )}

          <form onSubmit={saveYoutube} className="space-y-4">
            {playlistItems.length > 0 ? (
              <div className="border border-[#e2e8f0] rounded-lg divide-y divide-[#e2e8f0]">
                {playlistItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-[#f8f9fa] transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-[#2d3748] break-all">{item}</p>
                      <a
                        href={`https://www.youtube.com/watch?v=${item}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#4059ad] hover:underline mt-1 inline-block"
                      >
                        View on YouTube
                      </a>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="ml-4 px-3 py-1.5 rounded text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#e2e8f0] rounded-lg p-8 text-center">
                <p className="text-[#718096] text-sm">No items in playlist. Add YouTube URLs or IDs above.</p>
              </div>
            )}
            
            {canEdit && (
              <button
                type="submit"
                disabled={saving === "Youtube"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving === "Youtube" ? "Saving..." : "Save Changes"}
              </button>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}

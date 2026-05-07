"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type YoutubeHelpVideo = {
  title: string;
  videoId: string;
};

const DEFAULT_ROWS: YoutubeHelpVideo[] = [
  { title: "DMIT Help", videoId: "GbgYzN1zoWI" },
  { title: "DMIT Course", videoId: "jWxV99aaG1I" },
  { title: "What is DMIT Test?", videoId: "LUv7_3nvlW8" },
];

function extractVideoId(urlOrId: string): string | null {
  const trimmed = (urlOrId || "").trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export default function YoutubeHelpPage() {
  const { idToken, roleInfo } = useAuth();
  const canEdit = roleInfo?.role === "admin" || Boolean(roleInfo?.permissions?.canEditAppData);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<YoutubeHelpVideo[]>([]);

  const [newTitle, setNewTitle] = useState("");
  const [newUrlOrId, setNewUrlOrId] = useState("");

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube-help", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { videos?: YoutubeHelpVideo[] };
      const rows = Array.isArray(data.videos) && data.videos.length > 0 ? data.videos : DEFAULT_ROWS;
      setVideos(rows);
    } catch (e) {
      setVideos(DEFAULT_ROWS);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (nextVideos: YoutubeHelpVideo[]) => {
      if (!idToken) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/youtube-help", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ videos: nextVideos }),
        });
        if (!res.ok) throw new Error("Save failed");
        const data = (await res.json()) as { videos?: YoutubeHelpVideo[] };
        const saved = Array.isArray(data.videos) ? data.videos : nextVideos;
        setVideos(saved);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [idToken],
  );

  const addRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (saving) return;
    setError(null);

    const title = newTitle.trim();
    const videoId = extractVideoId(newUrlOrId);
    if (!title) return setError("Please enter a title.");
    if (!videoId) return setError("Please enter a valid YouTube URL or video ID.");
    if (videos.some((v) => v.videoId === videoId)) return setError("This video is already added.");

    const next = [...videos, { title, videoId }];
    setVideos(next);
    setNewTitle("");
    setNewUrlOrId("");
    await persist(next);
  };

  const removeRow = async (index: number) => {
    if (!canEdit) return;
    if (saving) return;
    const next = videos.filter((_, i) => i !== index);
    setVideos(next);
    await persist(next);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    await persist(videos);
  };

  const previewUrl = useMemo(() => {
    return (id: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">YouTube Help</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-2">YouTube Help</h1>
      <p className="text-[#718096] text-sm mb-6">
        These videos are shown inside the mobile app on the <strong>YouTube Help</strong> page.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
      )}

      <div className="max-w-4xl space-y-6">
        <section className="p-6 rounded-lg bg-white border border-[#e2e8f0] shadow-sm">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-4">Videos (appData/YoutubeHelp.videos)</h2>

          {canEdit && (
            <form onSubmit={addRow} className="mb-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title (e.g. DMIT Help)"
                  disabled={saving}
                  className="rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                />
                <input
                  type="text"
                  value={newUrlOrId}
                  onChange={(e) => setNewUrlOrId(e.target.value)}
                  placeholder="YouTube URL or video ID"
                  disabled={saving}
                  className="md:col-span-2 rounded-lg bg-white border border-[#e2e8f0] px-4 py-2.5 text-[#2d3748] placeholder-[#a0aec0] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#97d8c4] hover:bg-[#7fc9b3] text-white text-sm font-medium shadow-sm transition"
                >
                  {saving ? "Saving..." : "Add video"}
                </button>
                <p className="text-xs text-[#a0aec0]">Tip: paste any YouTube link; the ID will be extracted automatically. Add/Remove auto-saves.</p>
              </div>
            </form>
          )}

          {videos.length > 0 ? (
            <div className="border border-[#e2e8f0] rounded-lg divide-y divide-[#e2e8f0]">
              {videos.map((v, index) => (
                <div key={`${v.videoId}-${index}`} className="flex items-start justify-between p-3 hover:bg-[#f8f9fa] transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2d3748]">{v.title}</p>
                    <p className="text-xs font-mono text-[#718096] break-all">{v.videoId}</p>
                    <a
                      href={previewUrl(v.videoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#4059ad] hover:underline mt-1 inline-block"
                    >
                      Preview on YouTube
                    </a>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={saving}
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
              <p className="text-[#718096] text-sm">No videos configured yet.</p>
            </div>
          )}

          {canEdit && (
            <form onSubmit={save} className="mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50 shadow-sm transition"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}


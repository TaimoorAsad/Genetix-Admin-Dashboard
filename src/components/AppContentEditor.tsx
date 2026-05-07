"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type AppContentBlock = {
  id: string;
  section: string;
  type: "text" | "image" | "video";
  content: string;
  order: number;
};

type SectionKey = "testimonials" | "points-and-usage" | "about-us";

type Props = {
  section: SectionKey;
  title: string;
  description: string;
};

export default function AppContentEditor({ section, title, description }: Props) {
  const { idToken, roleInfo } = useAuth();
  const canEdit = roleInfo?.role === "admin" || Boolean(roleInfo?.permissions?.canEditAppData);
  const [items, setItems] = useState<AppContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"text" | "image" | "video">("text");
  const [addContent, setAddContent] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    if (!idToken) return;
    fetch(`/api/app-content?section=${section}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [idToken, section]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !canEdit) return;
    setError(null);
    setSavingId("new");
    try {
      const res = await fetch("/api/app-content", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          section,
          type: addType,
          content: addContent.trim(),
          order: items.length,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to create");
      }
      const created = await res.json();
      setItems((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setAddContent("");
      setShowAdd(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<AppContentBlock>) => {
    if (!idToken || !canEdit) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`/api/app-content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to update");
      }
      const updated = await res.json();
      setItems((prev) =>
        prev.map((it) => (it.id === id ? updated : it)).sort((a, b) => a.order - b.order)
      );
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!idToken || !canEdit || !confirm("Delete this block?")) return;
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`/api/app-content/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to delete");
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSavingId(null);
    }
  };

  const handleSeedAboutUs = async () => {
    if (section !== "about-us" || !idToken || !canEdit) return;
    if (!confirm("Import the default About Us content (text and link)? This only works when there are no existing blocks.")) return;
    setError(null);
    setSeeding(true);
    try {
      const res = await fetch("/api/app-content/seed-about-us", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) || "Failed to import");
      }
      setLoading(true);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setSeeding(false);
    }
  };

  const preview = (block: AppContentBlock) => {
    if (block.type === "text") return block.content.slice(0, 80) + (block.content.length > 80 ? "…" : "");
    if (block.type === "image") return block.content ? "Image URL" : "(no URL)";
    if (block.type === "video") return block.content ? "YouTube / video link" : "(no link)";
    return "";
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[#2d3748] mb-6">{title}</h1>
        <p className="text-[#718096]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-2">{title}</h1>
      <p className="text-[#718096] text-sm mb-6">{description}</p>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm overflow-hidden">
        {canEdit && (
          <div className="p-4 border-b border-[#e2e8f0] bg-[#f8f9fa] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium transition"
            >
              Add block (text, image, or video)
            </button>
            {section === "about-us" && (
              <button
                type="button"
                onClick={handleSeedAboutUs}
                disabled={seeding || items.length > 0}
                className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#718096] text-sm font-medium hover:bg-white hover:text-[#2d3748] transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={items.length > 0 ? "Delete existing blocks first to re-import" : "Import default About Us content from the app"}
              >
                {seeding ? "Importing…" : "Import default content"}
              </button>
            )}
          </div>
        )}

        {showAdd && (
          <form
            onSubmit={handleCreate}
            className="p-6 border-b border-[#e2e8f0] bg-[#f8f9fa] space-y-4"
          >
            <h2 className="text-lg font-semibold text-[#2d3748]">New block</h2>
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1">Type</label>
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value as "text" | "image" | "video")}
                className="w-full max-w-xs rounded-lg border border-[#e2e8f0] px-3 py-2 text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
              >
                <option value="text">Text</option>
                <option value="image">Image (URL)</option>
                <option value="video">Video (YouTube or video URL)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1">
                {addType === "text" ? "Text content" : addType === "image" ? "Image URL" : "YouTube or video URL"}
              </label>
              <textarea
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                rows={addType === "text" ? 4 : 2}
                required
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-[#2d3748] focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/20 outline-none"
                placeholder={
                  addType === "text"
                    ? "Paragraph or heading…"
                    : addType === "image"
                      ? "https://…"
                      : "https://www.youtube.com/… or video link"
                }
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingId === "new"}
                className="px-4 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium disabled:opacity-50"
              >
                {savingId === "new" ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddContent("");
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
                <th className="px-6 py-3 w-16">Order</th>
                <th className="px-6 py-3 w-24">Type</th>
                <th className="px-6 py-3">Content</th>
                {canEdit && <th className="px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-[#2d3748]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="px-6 py-8 text-center text-[#718096]">
                    No content yet. {canEdit && "Add a block to show in the app."}
                  </td>
                </tr>
              ) : (
                items.map((block) => (
                  <tr key={block.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fa]">
                    <td className="px-6 py-4">{block.order}</td>
                    <td className="px-6 py-4 font-medium capitalize">{block.type}</td>
                    <td className="px-6 py-4">
                      {editingId === block.id ? (
                        <div className="space-y-2">
                          <select
                            defaultValue={block.type}
                            className="rounded border border-[#e2e8f0] px-2 py-1 text-sm"
                            onChange={(e) =>
                              handleUpdate(block.id, {
                                type: e.target.value as "text" | "image" | "video",
                              })
                            }
                          >
                            <option value="text">Text</option>
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                          </select>
                          <textarea
                            defaultValue={block.content}
                            rows={3}
                            className="w-full rounded border border-[#e2e8f0] px-2 py-1 text-sm"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== block.content) handleUpdate(block.id, { content: v });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-[#718096] hover:text-[#2d3748] text-sm"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#718096] line-clamp-2">{preview(block)}</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        {editingId === block.id ? null : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(block.id)}
                              disabled={savingId !== null}
                              className="text-[#4059ad] hover:underline text-sm mr-3 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(block.id)}
                              disabled={savingId !== null}
                              className="text-red-600 hover:underline text-sm disabled:opacity-50"
                            >
                              {savingId === block.id ? "Deleting…" : "Delete"}
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

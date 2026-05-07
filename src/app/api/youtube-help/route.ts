import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission, requireView } from "@/lib/api-auth";

const DOC_ID = "YoutubeHelp";

type YoutubeHelpVideo = {
  title: string;
  videoId: string;
};

const DEFAULT_VIDEOS: YoutubeHelpVideo[] = [
  { title: "DMIT Help", videoId: "GbgYzN1zoWI" },
  { title: "DMIT Course", videoId: "jWxV99aaG1I" },
  { title: "What is DMIT Test?", videoId: "LUv7_3nvlW8" },
];

function normalizeVideoId(urlOrId: string): string | null {
  const trimmed = (urlOrId || "").trim();
  if (!trimmed) return null;

  // YouTube *video* id is exactly 11 chars.
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

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const viewErr = requireView(authResult.auth, "appData");
  if (viewErr) return viewErr;

  const db = getFirestore();
  try {
    const doc = await db.collection("appData").doc(DOC_ID).get();
    if (!doc.exists) {
      return NextResponse.json({ id: DOC_ID, videos: DEFAULT_VIDEOS }, { status: 200 });
    }
    const data = doc.data() || {};
    const rawVideos = Array.isArray((data as { videos?: unknown }).videos) ? (data as { videos: unknown[] }).videos : null;
    const videos: YoutubeHelpVideo[] = (rawVideos || [])
      .map((v) => {
        const obj = v as Partial<YoutubeHelpVideo>;
        const title = typeof obj.title === "string" ? obj.title.trim() : "";
        const vid = typeof obj.videoId === "string" ? normalizeVideoId(obj.videoId) : null;
        if (!title || !vid) return null;
        return { title, videoId: vid };
      })
      .filter(Boolean) as YoutubeHelpVideo[];

    return NextResponse.json(
      {
        id: DOC_ID,
        videos: videos && videos.length > 0 ? videos : DEFAULT_VIDEOS,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch YouTube Help videos" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;

  const body = (await req.json()) as { videos?: unknown };
  const incoming = Array.isArray(body.videos) ? (body.videos as unknown[]) : null;
  if (!incoming) return NextResponse.json({ error: "Invalid body: videos must be an array" }, { status: 400 });

  const videos: YoutubeHelpVideo[] = [];
  for (const v of incoming) {
    const obj = v as Partial<YoutubeHelpVideo>;
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const vidRaw = typeof obj.videoId === "string" ? obj.videoId : "";
    const videoId = normalizeVideoId(vidRaw);
    if (!title || !videoId) continue;
    videos.push({ title, videoId });
  }

  const db = getFirestore();
  try {
    await db.collection("appData").doc(DOC_ID).set({ videos }, { merge: true });
    return NextResponse.json({ id: DOC_ID, videos }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update YouTube Help videos" }, { status: 500 });
  }
}


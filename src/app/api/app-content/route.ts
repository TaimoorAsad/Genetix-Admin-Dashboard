import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView, requirePermission } from "@/lib/api-auth";

const COLLECTION = "appContent";

const SECTION_MAP: Record<string, string> = {
  testimonials: "testimonials",
  "points-and-usage": "pointsAndUsage",
  "about-us": "aboutUs",
};

function toBlock(doc: { id: string; data: () => Record<string, unknown> | undefined }) {
  const d = doc.data()!;
  return {
    id: doc.id,
    section: String(d.section ?? ""),
    type: d.type === "image" || d.type === "video" ? d.type : "text",
    content: String(d.content ?? ""),
    order: Number(d.order ?? 0),
  };
}

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "Use My profile for your data." }, { status: 403 });
  }
  const viewErr = requireView(authResult.auth, "appData");
  if (viewErr) return viewErr;
  const sectionParam = req.nextUrl.searchParams.get("section");
  const sectionKey = sectionParam && SECTION_MAP[sectionParam] ? SECTION_MAP[sectionParam] : null;
  if (!sectionKey) {
    return NextResponse.json(
      { error: "section is required: testimonials, points-and-usage, or about-us" },
      { status: 400 }
    );
  }
  const db = getFirestore();
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where("section", "==", sectionKey)
      .orderBy("order", "asc")
      .get();
    const items = snapshot.docs.map(toBlock);
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;
  const body = await req.json();
  const sectionParam = typeof body.section === "string" ? body.section.trim() : "";
  const sectionKey = SECTION_MAP[sectionParam] || null;
  if (!sectionKey) {
    return NextResponse.json(
      { error: "section is required: testimonials, points-and-usage, or about-us" },
      { status: 400 }
    );
  }
  const type = body.type === "image" || body.type === "video" ? body.type : "text";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const order = typeof body.order === "number" ? body.order : Number(body.order) || 0;
  const db = getFirestore();
  try {
    const ref = await db.collection(COLLECTION).add({
      section: sectionKey,
      type,
      content,
      order,
    });
    const doc = await ref.get();
    return NextResponse.json(toBlock(doc));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }
}

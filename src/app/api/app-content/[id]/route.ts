import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission } from "@/lib/api-auth";

const COLLECTION = "appContent";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.type === "image" || body.type === "video") updates.type = body.type;
  else if (body.type !== undefined) updates.type = "text";
  if (typeof body.content === "string") updates.content = body.content.trim();
  if (typeof body.order === "number") updates.order = body.order;
  else if (body.order !== undefined) updates.order = Number(body.order) || 0;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const db = getFirestore();
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Content block not found" }, { status: 404 });
    await ref.update(updates);
    const updated = await ref.get();
    return NextResponse.json(toBlock(updated));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update content" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDashboardAuth(_req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;
  const { id } = await params;
  const db = getFirestore();
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Content block not found" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 });
  }
}

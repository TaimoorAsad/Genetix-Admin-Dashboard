import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission } from "@/lib/api-auth";

const COLLECTION = "counsellingServices";

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
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null;
  if (typeof body.price === "number") updates.price = body.price;
  else if (body.price !== undefined) updates.price = Number(body.price) || 0;
  if (typeof body.order === "number") updates.order = body.order;
  else if (body.order !== undefined) updates.order = Number(body.order) || 0;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const db = getFirestore();
  try {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    await ref.update(updates);
    const updated = await ref.get();
    const d = updated.data()!;
    return NextResponse.json({
      id: updated.id,
      name: String(d.name ?? ""),
      description: d.description != null ? String(d.description) : undefined,
      price: Number(d.price ?? 0),
      order: Number(d.order ?? 0),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update counselling service" }, { status: 500 });
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
    if (!doc.exists) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete counselling service" }, { status: 500 });
  }
}

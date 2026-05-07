import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission, requireFranchiseAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const { id } = await params;
  const accessErr = requireFranchiseAccess(authResult.auth, id);
  if (accessErr) return accessErr;
  const db = getFirestore();
  try {
    const doc = await db.collection("Franchises").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Franchise not found" }, { status: 404 });
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch franchise" }, { status: 500 });
  }
}

const FRANCHISE_SELF_PATCH_KEYS = ["number", "name", "email", "phone"] as const;
const ADMIN_FRANCHISE_PATCH_KEYS = [
  ...FRANCHISE_SELF_PATCH_KEYS,
  "canEditFranchiseUsers",
  "canDeleteFranchiseUsers",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const { id } = await params;
  const accessErr = requireFranchiseAccess(authResult.auth, id);
  if (accessErr) return accessErr;
  const isOwnFranchise = authResult.auth.role === "franchise" && authResult.auth.franchiseId === id;
  if (!isOwnFranchise) {
    const permErr = requirePermission(authResult.auth, "canEditFranchises");
    if (permErr) return permErr;
  }
  const body = (await req.json()) as Record<string, unknown>;
  const db = getFirestore();
  const updates: Record<string, unknown> = {};
  const keys = isOwnFranchise ? FRANCHISE_SELF_PATCH_KEYS : ADMIN_FRANCHISE_PATCH_KEYS;
  for (const k of keys) {
    if (body[k] === undefined) continue;
    if (k === "canEditFranchiseUsers" || k === "canDeleteFranchiseUsers") {
      updates[k] = Boolean(body[k]);
    } else if (k === "email" || k === "phone") {
      const v = body[k];
      updates[k] = typeof v === "string" && v.trim() === "" ? null : v;
    } else {
      updates[k] = body[k];
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  try {
    await db.collection("Franchises").doc(id).update(updates);
    const doc = await db.collection("Franchises").doc(id).get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update franchise" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canDeleteFranchises");
  if (permErr) return permErr;
  const { id } = await params;
  const db = getFirestore();
  try {
    await db.collection("Franchises").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete franchise" }, { status: 500 });
  }
}

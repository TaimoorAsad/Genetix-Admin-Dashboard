import { NextRequest, NextResponse } from "next/server";
import { getFirestore, DASHBOARD_ROLES_COLLECTION } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";
import {
  type StaffPermissions,
  STAFF_PERMISSION_KEYS,
} from "@/lib/dashboard-roles";

/** Admin only: get one dashboard role doc. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }
  const { uid } = await params;
  const db = getFirestore();
  try {
    const doc = await db.collection(DASHBOARD_ROLES_COLLECTION).doc(uid).get();
    if (!doc.exists) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json({ uid: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

/** Admin only: update dashboard role (e.g. staff permissions). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }
  const { uid } = await params;
  const body = await req.json();
  const db = getFirestore();
  const docRef = db.collection(DASHBOARD_ROLES_COLLECTION).doc(uid);
  const doc = await docRef.get();
  if (!doc.exists) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  const data = doc.data() as { role?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.role === "staff" && body.permissions != null) {
    const perms: StaffPermissions = {};
    for (const key of STAFF_PERMISSION_KEYS) {
      if (body.permissions[key] !== undefined) perms[key] = Boolean(body.permissions[key]);
    }
    updates.permissions = perms;
  }
  if (body.franchiseId !== undefined && (data.role === "franchise" || body.role === "franchise"))
    updates.franchiseId = String(body.franchiseId);
  if (body.userId !== undefined && (data.role === "user" || body.role === "user"))
    updates.userId = String(body.userId);
  if (body.email !== undefined) updates.email = String(body.email).trim();
  try {
    await docRef.update(updates);
    const updated = await docRef.get();
    return NextResponse.json({ uid: updated.id, ...updated.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

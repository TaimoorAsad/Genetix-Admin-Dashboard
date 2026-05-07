import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getAuth, DASHBOARD_ROLES_COLLECTION } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";
import {
  type DashboardRole,
  type StaffPermissions,
  STAFF_PERMISSION_KEYS,
  DEFAULT_STAFF_PERMISSIONS,
} from "@/lib/dashboard-roles";

/** Admin only: list all dashboard role docs (staff, franchise, user; optionally include admins from env). */
export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }
  const db = getFirestore();
  try {
    const snapshot = await db.collection(DASHBOARD_ROLES_COLLECTION).get();
    const roles = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json({ roles });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list roles" }, { status: 500 });
  }
}

/** Admin only: create a dashboard role doc (staff, franchise, or user). */
export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }
  const body = await req.json();
  const role = body.role as DashboardRole | undefined;
  if (!role || !["staff", "franchise", "user"].includes(role)) {
    return NextResponse.json({ error: "role must be staff, franchise, or user" }, { status: 400 });
  }
  const uid = (body.uid as string)?.trim();
  const email = (body.email as string)?.trim();
  if (!uid && !email) {
    return NextResponse.json({ error: "uid or email required" }, { status: 400 });
  }
  const db = getFirestore();
  const auth = getAuth();
  let targetUid = uid;
  if (!targetUid && email) {
    const userRecord = await auth.getUserByEmail(email).catch(() => null);
    if (!userRecord) {
      return NextResponse.json(
        { error: "No Firebase user found with that email. Create the user in Firebase Auth first." },
        { status: 400 }
      );
    }
    targetUid = userRecord.uid;
  }
  const existing = await db.collection(DASHBOARD_ROLES_COLLECTION).doc(targetUid!).get();
  if (existing.exists) {
    return NextResponse.json({ error: "Dashboard role already exists for this user" }, { status: 409 });
  }
  const data: Record<string, unknown> = {
    role,
    email: email || undefined,
    updatedAt: new Date(),
  };
  if (role === "staff") {
    const perms: StaffPermissions = {};
    for (const key of STAFF_PERMISSION_KEYS) {
      perms[key] = body.permissions?.[key] ?? DEFAULT_STAFF_PERMISSIONS[key];
    }
    data.permissions = perms;
  }
  if (role === "franchise" && body.franchiseId) data.franchiseId = String(body.franchiseId);
  if (role === "user" && body.userId) data.userId = String(body.userId);
  try {
    await db.collection(DASHBOARD_ROLES_COLLECTION).doc(targetUid!).set(data);
    const doc = await db.collection(DASHBOARD_ROLES_COLLECTION).doc(targetUid!).get();
    return NextResponse.json({ uid: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}

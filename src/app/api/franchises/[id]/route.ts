import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";
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

  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (Object.keys(updates).length === 0 && !password) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    if (Object.keys(updates).length > 0) {
      await db.collection("Franchises").doc(id).update(updates);
    }

    if (password) {
      const auth = getAuth();
      const rolesSnap = await db.collection("dashboardRoles")
        .where("role", "==", "franchise")
        .where("franchiseId", "==", id)
        .limit(1)
        .get();

      if (!rolesSnap.empty) {
        const roleDoc = rolesSnap.docs[0];
        const uid = roleDoc.id;
        const currentRoleData = roleDoc.data();
        const currentEmail = updates.email !== undefined ? (updates.email as string) : currentRoleData.email;

        if (!currentEmail) {
          return NextResponse.json({ error: "Franchise email is required to update the password." }, { status: 400 });
        }

        await auth.updateUser(uid, {
          password: password,
          email: currentEmail,
        });

        if (updates.email !== undefined) {
          await roleDoc.ref.update({ email: updates.email });
        }
      } else {
        const currentFranchiseSnap = await db.collection("Franchises").doc(id).get();
        const currentFranchiseData = currentFranchiseSnap.data() || {};
        const email = (updates.email !== undefined ? updates.email : currentFranchiseData.email) as string;
        const name = (updates.name !== undefined ? updates.name : currentFranchiseData.name) as string;

        if (!email) {
          return NextResponse.json({ error: "Email is required to create a login account for this franchise." }, { status: 400 });
        }

        const userRecord = await auth.createUser({
          email: email,
          password: password,
          displayName: name || undefined,
        });

        await db.collection("dashboardRoles").doc(userRecord.uid).set({
          role: "franchise",
          franchiseId: id,
          email: email,
        });
      }
    } else if (updates.email !== undefined) {
      const rolesSnap = await db.collection("dashboardRoles")
        .where("role", "==", "franchise")
        .where("franchiseId", "==", id)
        .limit(1)
        .get();

      if (!rolesSnap.empty) {
        const roleDoc = rolesSnap.docs[0];
        const uid = roleDoc.id;
        const auth = getAuth();
        try {
          await auth.updateUser(uid, { email: (updates.email as string) || undefined });
        } catch {
          // Ignore auth errors if not found/invalid
        }
        await roleDoc.ref.update({ email: updates.email });
      }
    }

    const doc = await db.collection("Franchises").doc(id).get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Failed to update franchise";
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const rolesSnap = await db.collection("dashboardRoles")
      .where("role", "==", "franchise")
      .where("franchiseId", "==", id)
      .get();
      
    const auth = getAuth();
    for (const doc of rolesSnap.docs) {
      const uid = doc.id;
      try {
        await auth.deleteUser(uid);
      } catch {
        // Auth user might not exist
      }
      await doc.ref.delete();
    }

    await db.collection("Franchises").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Failed to delete franchise";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

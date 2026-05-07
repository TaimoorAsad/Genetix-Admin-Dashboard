import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";
import {
  requireDashboardAuth,
  requirePermission,
  requireUserAccess,
} from "@/lib/api-auth";
import { assertFranchiseCanManageUser } from "@/lib/franchise-user-access";
import { sendMail } from "@/lib/mailer";

/** Fields a franchise may edit for linked users (no referral/franchise/privilege fields). */
const FRANCHISE_EDITABLE_USER_FIELDS = [
  "Full Name",
  "Father's Name",
  "Mother's Name",
  "Gender",
  "Education",
  "Phone Number",
  "Email",
  "Place of Birth",
  "Date of Birth",
  "Time of Birth",
  "Profile Url",
] as const;

const STAFF_EDITABLE_USER_FIELDS = [
  "Full Name",
  "Father's Name",
  "Mother's Name",
  "Gender",
  "Education",
  "Franchise",
  "Phone Number",
  "Email",
  "Place of Birth",
  "Date of Birth",
  "Time of Birth",
  "Profile Url",
  "isEliteMember",
  "ReportNormal",
  "ReportPremium",
  "NumerologyCourse",
  "GraphologyCourse",
  "LearnAndEarn",
  "ReferralCount",
  "ReferralPoints",
  "ReferralPaid",
  "isSubmitted",
] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const { id } = await params;
  const db = getFirestore();
  const accessErr = requireUserAccess(authResult.auth, id);
  if (accessErr) {
    if (authResult.auth.role !== "franchise") return accessErr;
    const frErr = await assertFranchiseCanManageUser(db, authResult.auth, id, "read");
    if (frErr) return frErr;
  }
  try {
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const { id } = await params;
  const db = getFirestore();
  const permErr = requirePermission(authResult.auth, "canEditUsers");
  let allowedKeys: readonly string[] = STAFF_EDITABLE_USER_FIELDS;
  if (permErr) {
    if (authResult.auth.role !== "franchise") return permErr;
    const frErr = await assertFranchiseCanManageUser(db, authResult.auth, id, "edit");
    if (frErr) return frErr;
    allowedKeys = FRANCHISE_EDITABLE_USER_FIELDS;
  }
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  try {
    await db.collection("users").doc(id).update(updates);
    const doc = await db.collection("users").doc(id).get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const { id } = await params;
  const db = getFirestore();
  const permErr = requirePermission(authResult.auth, "canDeleteUsers");
  if (permErr) {
    if (authResult.auth.role !== "franchise") return permErr;
    const frErr = await assertFranchiseCanManageUser(db, authResult.auth, id, "delete");
    if (frErr) return frErr;
  }
  const auth = getAuth();
  try {
    const ref = db.collection("users").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userData = doc.data() ?? {};
    const userEmail = typeof userData.Email === "string" ? userData.Email.trim() : "";
    const userName = typeof userData["Full Name"] === "string" ? userData["Full Name"].trim() : "User";

    const subcollections = ["LeftHandFingerprints", "RightHandFingerprints"];
    for (const sub of subcollections) {
      const snap = await ref.collection(sub).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (snap.docs.length) await batch.commit();
    }
    await ref.delete();
    try {
      await auth.deleteUser(id);
    } catch {
      // Auth user may not exist
    }

    if (userEmail) {
      sendMail({
        to: userEmail,
        subject: "Your Genetix account has been removed",
        text: `Dear ${userName},\n\nYour account and all associated data have been removed from the Genetix app by an administrator.\n\nIf you believe this was a mistake or have any questions, please contact our support team.\n\nRegards,\nThe Genetix Team`,
      }).catch((err) => console.error("Failed to send deletion email:", err));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

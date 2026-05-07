import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const viewErr = requireView(authResult.auth, "appData");
  if (viewErr) return viewErr;
  const docId = req.nextUrl.searchParams.get("doc") || "AppLink";
  const db = getFirestore();
  try {
    const doc = await db.collection("appData").doc(docId).get();
    if (!doc.exists) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch app data" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;
  const body = await req.json();
  const docId = body.docId || body.doc || "AppLink";
  const db = getFirestore();
  const updates = { ...body };
  delete updates.docId;
  delete updates.doc;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  try {
    await db.collection("appData").doc(docId).set(updates, { merge: true });
    const doc = await db.collection("appData").doc(docId).get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update app data" }, { status: 500 });
  }
}

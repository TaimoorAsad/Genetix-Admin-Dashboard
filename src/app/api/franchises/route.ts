import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const db = getFirestore();
  try {
    if (authResult.auth.role === "franchise" && authResult.auth.franchiseId) {
      const doc = await db.collection("Franchises").doc(authResult.auth.franchiseId).get();
      if (!doc.exists) return NextResponse.json({ error: "Franchise not found" }, { status: 404 });
      return NextResponse.json({ franchises: [{ id: doc.id, ...doc.data() }] });
    }
    const viewErr = requireView(authResult.auth, "franchises");
    if (viewErr) return viewErr;
    const snapshot = await db.collection("Franchises").get();
    const franchises = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ franchises });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch franchises" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditFranchises");
  if (permErr) return permErr;
  const db = getFirestore();
  const body = await req.json();
  const { number, name, ...rest } = body;
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });
  try {
    const ref = await db.collection("Franchises").add({ number: String(number), name: name || "", ...rest });
    const doc = await ref.get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create franchise" }, { status: 500 });
  }
}

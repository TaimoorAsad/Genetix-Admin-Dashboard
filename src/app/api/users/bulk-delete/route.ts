import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;

  const permErr = requirePermission(authResult.auth, "canDeleteUsers");
  if (permErr) return permErr;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray((body as { ids?: unknown }).ids)
    ? (body as { ids: unknown[] }).ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : [];

  if (!ids.length) {
    return NextResponse.json({ error: "ids (string[]) is required" }, { status: 400 });
  }

  const db = getFirestore();
  const batch = db.batch();
  ids.forEach((id) => {
    batch.delete(db.collection("users").doc(id));
  });

  try {
    await batch.commit();
    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (e) {
    console.error("Bulk delete users failed", e);
    return NextResponse.json({ error: "Failed to delete users" }, { status: 500 });
  }
}


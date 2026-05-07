import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";

const REQUESTS_COLLECTION = "franchiseRequests";

/** Admin only: reject a franchise request */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { id: requestId } = await params;
  const db = getFirestore();
  const requestRef = db.collection(REQUESTS_COLLECTION).doc(requestId);
  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  const status = (requestDoc.data()?.status as string) || "";
  if (status !== "pending") {
    return NextResponse.json({ error: "Request is already " + status }, { status: 400 });
  }
  try {
    await requestRef.update({ status: "rejected", rejectedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
  }
}

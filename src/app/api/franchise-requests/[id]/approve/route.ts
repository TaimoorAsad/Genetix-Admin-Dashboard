import { NextRequest, NextResponse } from "next/server";
import { getFirestore, DASHBOARD_ROLES_COLLECTION } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";

const REQUESTS_COLLECTION = "franchiseRequests";
const FRANCHISES_COLLECTION = "Franchises";

/** Admin only: approve a franchise request → create Franchise doc + dashboard role, update request status */
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

  const data = requestDoc.data()!;
  const status = data.status as string;
  if (status !== "pending") {
    return NextResponse.json({ error: "Request is already " + status }, { status: 400 });
  }

  const uid = data.uid as string;
  const email = (data.email as string) || "";
  const franchiseName = (data.franchiseName as string) || "";
  const number = (data.number as string) || "";
  const phone = (data.phone as string) || "";

  try {
    const franchiseRef = await db.collection(FRANCHISES_COLLECTION).add({
      number: number || phone || email.split("@")[0],
      name: franchiseName,
      email: email || null,
      phone: phone || null,
    });
    const franchiseId = franchiseRef.id;

    await db.collection(DASHBOARD_ROLES_COLLECTION).doc(uid).set({
      role: "franchise",
      email: email || undefined,
      franchiseId,
      updatedAt: new Date(),
    });

    await requestRef.update({ status: "approved", approvedAt: new Date(), franchiseId });

    return NextResponse.json({ success: true, franchiseId, message: "Franchise approved. They can now log in with their email and password." });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
  }
}

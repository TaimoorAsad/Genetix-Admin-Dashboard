import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";

type ReferredUser = { uid: string; name: string; email: string; phone: string; registeredOn: string };

/** Franchise role only: return own franchise (Franchises/{franchiseId}) with referral stats. */
export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "franchise" || !authResult.auth.franchiseId) {
    return NextResponse.json({ error: "Forbidden: franchise role required" }, { status: 403 });
  }
  const db = getFirestore();
  try {
    const doc = await db.collection("Franchises").doc(authResult.auth.franchiseId).get();
    if (!doc.exists) return NextResponse.json({ error: "Franchise not found" }, { status: 404 });

    const franchiseData = doc.data()!;
    const franchiseNumber = (franchiseData.number as string) || "";

    let referralCount = 0;
    const referredUsers: ReferredUser[] = [];

    if (franchiseNumber) {
      const usersSnap = await db
        .collection("users")
        .where("Franchise", "==", franchiseNumber)
        .limit(500)
        .get();

      referralCount = usersSnap.size;
      for (const userDoc of usersSnap.docs) {
        const u = userDoc.data();
        referredUsers.push({
          uid: userDoc.id,
          name: String(u["Full Name"] ?? ""),
          email: String(u["Email"] ?? ""),
          phone: String(u["Phone Number"] ?? ""),
          registeredOn: String(u["Registered On"] ?? ""),
        });
      }
    }

    return NextResponse.json({
      id: doc.id,
      ...franchiseData,
      referralCount,
      referredUsers,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch franchise" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";

/** User role only: return own profile (users/{userId}). */
export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "user" || !authResult.auth.userId) {
    return NextResponse.json({ error: "Forbidden: user role required" }, { status: 403 });
  }
  const db = getFirestore();
  try {
    const doc = await db.collection("users").doc(authResult.auth.userId).get();
    if (!doc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const data = doc.data() || {};
    const myPhone = (data["Phone Number"] as string | undefined) || "";

    // People this user referred (their phone number stored as ReferralCode on others).
    let referredByMe: { id: string; fullName?: string; phone?: string }[] = [];
    if (myPhone) {
      const referredSnap = await db
        .collection("users")
        .where("ReferralCode", "==", myPhone)
        .limit(50)
        .get();
      referredByMe = referredSnap.docs.map((d) => {
        const u = d.data() as { "Full Name"?: unknown; "Phone Number"?: unknown };
        return {
          id: d.id,
          fullName: typeof u["Full Name"] === "string" ? (u["Full Name"] as string) : undefined,
          phone: typeof u["Phone Number"] === "string" ? (u["Phone Number"] as string) : undefined,
        };
      });
    }

    return NextResponse.json({
      id: doc.id,
      ...data,
      referredByMe,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

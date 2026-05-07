import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const viewErr = requireView(authResult.auth, "stats");
  if (viewErr) return viewErr;
  const db = getFirestore();
  try {
    const [usersSnap, franchisesSnap, franchisesListSnap, usersListSnap] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("Franchises").count().get(),
      db.collection("Franchises").limit(5).get(),
      db.collection("users").limit(200).get(),
    ]);

    const totalUsers = usersSnap.data().count;
    const totalFranchises = franchisesSnap.data().count;

    const topFranchises = franchisesListSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name ?? "",
      number: d.data().number ?? "",
    }));

    const usersWithReferrals = usersListSnap.docs
      .map((d) => ({
        id: d.id,
        "Full Name": d.data()["Full Name"] ?? "",
        ReferralCount: typeof d.data().ReferralCount === "number" ? d.data().ReferralCount : 0,
      }))
      .filter((u) => u.ReferralCount > 0)
      .sort((a, b) => b.ReferralCount - a.ReferralCount)
      .slice(0, 5);

    return NextResponse.json({
      totalUsers,
      totalFranchises,
      totalRequests: 0,
      topFranchises,
      topReferralUsers: usersWithReferrals,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView } from "@/lib/api-auth";

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
const TOTAL_IMAGES = 5 * 3 * 2; // 5 fingers × 3 positions × 2 hands = 30

type Firestore = ReturnType<typeof getFirestore>;

async function hasAllImages(db: Firestore, userId: string): Promise<boolean> {
  try {
    const userRef = db.collection("users").doc(userId);
    const [leftSnap, rightSnap] = await Promise.all([
      userRef.collection("LeftHandFingerprints").get(),
      userRef.collection("RightHandFingerprints").get(),
    ]);
    let imageCount = 0;
    for (const finger of FINGERS) {
      const leftDoc = leftSnap.docs.find((d) => d.id === finger);
      const rightDoc = rightSnap.docs.find((d) => d.id === finger);
      if (leftDoc) {
        const data = leftDoc.data();
        if (data.Left?.image) imageCount++;
        if (data.Center?.image) imageCount++;
        if (data.Right?.image) imageCount++;
      }
      if (rightDoc) {
        const data = rightDoc.data();
        if (data.Left?.image) imageCount++;
        if (data.Center?.image) imageCount++;
        if (data.Right?.image) imageCount++;
      }
    }
    return imageCount === TOTAL_IMAGES;
  } catch {
    return false;
  }
}

type Period = "day" | "week" | "month" | "year";

function getStartDate(period: Period): Date {
  const now = new Date();
  const start = new Date(now);
  
  switch (period) {
    case "day":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      const dayOfWeek = now.getDay();
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return start;
}

function groupByPeriod(data: { timestamp: Date }[], period: Period): Record<string, number> {
  const grouped: Record<string, number> = {};
  
  data.forEach(({ timestamp }) => {
    const date = new Date(timestamp);
    let key: string;
    
    switch (period) {
      case "day":
        key = date.toISOString().split("T")[0];
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "year":
        key = String(date.getFullYear());
        break;
      default:
        key = date.toISOString().split("T")[0];
    }
    
    grouped[key] = (grouped[key] || 0) + 1;
  });
  
  return grouped;
}

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const viewErr = requireView(authResult.auth, "stats");
  if (viewErr) return viewErr;

  const db = getFirestore();
  const period = (req.nextUrl.searchParams.get("period") || "month") as Period;
  const startDate = getStartDate(period);
  
  try {
    const usersSnap = await db.collection("users").limit(1000).get();
    const completedUsers: { timestamp: Date }[] = [];
    
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const registeredOn = userData["Registered On"]?.toDate?.() || null;
      
      if (registeredOn && registeredOn >= startDate) {
        const hasAll = await hasAllImages(db, userDoc.id);
        if (hasAll) {
          completedUsers.push({ timestamp: registeredOn });
        }
      }
    }
    
    const grouped = groupByPeriod(completedUsers, period);
    const labels = Object.keys(grouped).sort();
    const values = labels.map((key) => grouped[key]);
    const totalCompleted = completedUsers.length;
    
    return NextResponse.json({
      period,
      labels,
      values,
      totalCompleted,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch pictures completed data" }, { status: 500 });
  }
}

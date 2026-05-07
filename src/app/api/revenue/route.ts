import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView } from "@/lib/api-auth";

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

function groupByPeriod(data: { timestamp: Date; amount: number }[], period: Period): Record<string, number> {
  const grouped: Record<string, number> = {};
  
  data.forEach(({ timestamp, amount }) => {
    const date = new Date(timestamp);
    let key: string;
    
    switch (period) {
      case "day":
        key = date.toISOString().split("T")[0]; // YYYY-MM-DD
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
        break;
      case "year":
        key = String(date.getFullYear());
        break;
      default:
        key = date.toISOString().split("T")[0];
    }
    
    grouped[key] = (grouped[key] || 0) + amount;
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
    const usersSnap = await db.collection("users").get();
    const transactions: { timestamp: Date; amount: number }[] = [];
    
    for (const userDoc of usersSnap.docs) {
      const transactionsSnap = await userDoc.ref.collection("transactions").get();
      transactionsSnap.docs.forEach((txDoc) => {
        const data = txDoc.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data["transaction date"] || Date.now());
        const amount = parseFloat(String(data.amount || 0));
        
        if (timestamp >= startDate && !isNaN(amount) && amount > 0) {
          transactions.push({ timestamp, amount });
        }
      });
    }
    
    const grouped = groupByPeriod(transactions, period);
    const labels = Object.keys(grouped).sort();
    const values = labels.map((key) => grouped[key]);
    const totalRevenue = values.reduce((sum, val) => sum + val, 0);
    
    return NextResponse.json({
      period,
      labels,
      values,
      totalRevenue,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch revenue data" }, { status: 500 });
  }
}

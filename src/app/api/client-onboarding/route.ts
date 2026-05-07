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
    case "week": {
      const dayOfWeek = now.getDay();
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      break;
    }
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

function groupByPeriod(
  data: { timestamp: Date }[],
  period: Period
): Record<string, number> {
  const grouped: Record<string, number> = {};

  data.forEach(({ timestamp }) => {
    const date = new Date(timestamp);
    let key: string;

    switch (period) {
      case "day":
        key = date.toISOString().split("T")[0];
        break;
      case "week": {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      }
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
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
    return NextResponse.json(
      { error: "You can only access your own data. Use My profile." },
      { status: 403 }
    );
  }
  const viewErr = requireView(authResult.auth, "stats");
  if (viewErr) return viewErr;

  const db = getFirestore();
  const period = (req.nextUrl.searchParams.get("period") || "month") as Period;
  const startDate = getStartDate(period);

  try {
    const usersSnap = await db.collection("users").limit(2000).get();
    const onboarded: { timestamp: Date }[] = [];

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data() as Record<string, unknown>;
      let registeredOn: Date | null = null;

      const registeredField = data["Registered On"] as
        | { toDate?: () => Date }
        | string
        | null
        | undefined;
      if (registeredField && typeof registeredField === "object" && typeof registeredField.toDate === "function") {
        registeredOn = registeredField.toDate();
      } else if (typeof registeredField === "string") {
        const parsed = new Date(registeredField);
        if (!Number.isNaN(parsed.getTime())) {
          registeredOn = parsed;
        }
      }

      if (registeredOn && registeredOn >= startDate) {
        onboarded.push({ timestamp: registeredOn });
      }
    }

    const grouped = groupByPeriod(onboarded, period);
    const labels = Object.keys(grouped).sort();
    const values = labels.map((key) => grouped[key]);
    const totalCount = onboarded.length;

    return NextResponse.json({
      period,
      labels,
      values,
      totalCount,
    });
  } catch (e) {
    console.error("Failed to fetch client onboarding data", e);
    return NextResponse.json(
      { error: "Failed to fetch client onboarding data" },
      { status: 500 }
    );
  }
}

